"""Reproduce and check the annual Geostat education statistics research package.

Uses Python's standard library only. Never downloads sources or serves product data.
The CSV writer is reused from the unemployment package, as the business package does. The worksheet reader is this
package's own: the shared one refuses sheet "1" of a workbook that has a second sheet (table 06) and leaves Excel's
built-in number formats unnamed. Every column is found by its printed year heading (and the Total/Women/Men or
measure heading under it) and every row by its printed label, never by position.

    python3 prepare.py           # rebuild every generated file
    python3 prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
import csv
from decimal import Context, Decimal, ROUND_HALF_UP
import functools
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile


sys.dont_write_bytecode = True  # Loading the shared writer must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes = _shared.clean, _shared.csv_bytes

UNITS_FILE = REPO / 'data' / 'mappings' / 'education' / 'units.csv'
KNOWN_DIFFERENCES_FILE = REPO / 'data' / 'mappings' / 'education' / 'known-differences.csv'
MUNICIPALITIES_FILE = REPO / 'data' / 'imports' / 'municipalities.csv'

RETRIEVED_DATE = '2026-10-16'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
XLS = 'application/vnd.ms-excel'
HTML = 'text/html; charset=UTF-8'
PRESCHOOL_PAGE = 'https://www.geostat.ge/en/modules/categories/58/early-and-preschool-education'
GENERAL_PAGE = 'https://www.geostat.ge/en/modules/categories/59/general-education'
VOCATIONAL_PAGE = 'https://www.geostat.ge/en/modules/categories/60/professional-education'
HIGHER_PAGE = 'https://www.geostat.ge/en/modules/categories/61/higher-education'


def _media(number, name):
    return f'https://geostat.ge/media/{number}/{name}', f'https://www.geostat.ge/media/{number}/{name}'


def _source(source_id, title, page, number, url_name, local_name, content_type, retrieved_at):
    return (source_id, title, page, *_media(number, url_name), f'official/{local_name}', content_type, retrieved_at)


# (source_id, title, page, URL, resolved URL, local file, content type, retrieval time in UTC). Titles are the
# category pages' own headings; times are download completions. Every link redirects from geostat.ge to www.geostat.ge.
SOURCES = [
    # The six served workbooks (spec section 9).
    _source('geostat_education_schools_national', 'Number of General Education Schools and Pupils in them', GENERAL_PAGE, 75485,
            '01_Number-of-General-Education-Schools-and-Pupils-in-them.xlsx',
            '01_Number-of-General-Education-Schools-and-Pupils-in-them.xlsx', XLSX, '2026-10-16T16:51:34Z'),
    _source('geostat_education_teachers_national', 'Number of general education school teachers', GENERAL_PAGE, 82976,
            '06_Number-of-General-Education-School-Teachers.xlsx', '06_Number-of-General-Education-School-Teachers.xlsx', XLSX,
            '2026-10-16T16:52:02Z'),
    _source('geostat_education_municipal', 'Number of Public and Private Schools, Pupils and Teachers by Municipalities', GENERAL_PAGE,
            82978, '11_Number-of-schools_Pupils_Teachers-by-Municipalities.xlsx',
            '11_Number-of-schools_Pupils_Teachers-by-Municipalities.xlsx', XLSX, '2026-10-16T16:52:04Z'),
    _source('geostat_education_kindergartens', 'Indicators on Public Preschool Education and Care (PEC) Institutions', PRESCHOOL_PAGE,
            75474, 'Indicators-on-Public-Preschool-Education-and-Care-%28PEC%29-Institutions.xlsx',
            'Indicators-on-Public-Preschool-Education-and-Care-(PEC)-Institutions.xlsx', XLSX, '2026-10-16T16:51:31Z'),
    _source('geostat_education_higher', 'Admission, Number of Students and Graduates in Public and Private Higher Education '
            'Institutions by Programme and Sex', HIGHER_PAGE, 77160, '01Number-of-Students-Admission-Graduates-by-Programmes-and-Sex.xlsx',
            '01Number-of-Students-Admission-Graduates-by-Programmes-and-Sex.xlsx', XLSX, '2026-10-16T16:52:40Z'),
    _source('geostat_education_vocational', "Number of students in Public and Private Vocational Education Institutions' Education "
            'Programs', VOCATIONAL_PAGE, 77195,
            'Number-of-students-in-Public-and-Private-Vocational-Education-Institutions%27-Education-Programs.xlsx',
            "Number-of-students-in-Public-and-Private-Vocational-Education-Institutions'-Education-Programs.xlsx", XLSX,
            '2026-10-16T16:52:31Z'),
    # Archived only: general education (category 59).
    _source('geostat_education_schools_by_stage_region', 'Number of Schools by Stages and Regions', GENERAL_PAGE, 75486,
            '02_Number-of-schools-by-stages-and-regions.xlsx', '02_Number-of-schools-by-stages-and-regions.xlsx', XLSX,
            '2026-10-16T16:51:36Z'),
    _source('geostat_education_pupils_by_grade_age', 'Number of General Education School Pupils by Grades and Ages', GENERAL_PAGE, 75487,
            '04_Number-of-general-Education-School-Pupils-by-grades-and-ages.XLSX',
            '04_Number-of-general-Education-School-Pupils-by-grades-and-ages.XLSX', XLSX, '2026-10-16T16:51:38Z'),
    _source('geostat_education_pupils_by_level_grade', 'Distribution of Public and Private General School Pupils by Level of Education '
            'and Grades', GENERAL_PAGE, 75488,
            '05_Distribution-of-Public-and-Private-General-School--Pupils-by-Level-of-Education-and-Grades.xlsx',
            '05_Distribution-of-Public-and-Private-General-School--Pupils-by-Level-of-Education-and-Grades.xlsx', XLSX,
            '2026-10-16T16:51:40Z'),
    _source('geostat_education_pupils_suspended', 'The number of pupils of General Education Schools whose status was suspended or '
            'terminated categorized by grade and sex', GENERAL_PAGE, 75490, '08_suspended-or-terminated-out-studying.xlsx',
            '08_suspended-or-terminated-out-studying.xlsx', XLSX, '2026-10-16T16:51:42Z'),
    _source('geostat_education_pupils_ict', 'Number of Pupils studying ICT', GENERAL_PAGE, 75491, '10_ICT.xlsx', '10_ICT.xlsx', XLSX,
            '2026-10-16T16:51:44Z'),
    _source('geostat_education_school_graduates', 'Graduates from primary, basic and secondary schools', GENERAL_PAGE, 75493,
            '12_Graduation.xlsx', '12_Graduation.xlsx', XLSX, '2026-10-16T16:51:46Z'),
    _source('geostat_education_pupils_social_status', 'Number of Pupils of General Education Schools by Social Status', GENERAL_PAGE,
            75494, '13_Social-status.xlsx', '13_Social-status.xlsx', XLSX, '2026-10-16T16:51:48Z'),
    _source('geostat_education_enrolment_rates', 'Enrollment rate by sex and Level of Education', GENERAL_PAGE, 82622,
            'Net-and-Gross-Enrollment.xlsx', 'Net-and-Gross-Enrollment.xlsx', XLSX, '2026-10-16T16:51:50Z'),
    _source('geostat_education_proficiency', 'Percentage of students at each proficiency level', GENERAL_PAGE, 82692,
            'proficiency-level_EN.xlsx', 'proficiency-level_EN.xlsx', XLSX, '2026-10-16T16:52:00Z'),
    _source('geostat_education_grade_progression', 'Grade progression rates in general education schools', GENERAL_PAGE, 83261,
            '14_transfer-from_to-grade.xlsx', '14_transfer-from_to-grade.xlsx', XLSX, '2026-10-16T16:52:06Z'),
    _source('geostat_education_school_to_vet', 'Graduates of Basic General Education who Entered Vocational Education Institutions in '
            'their Graduation Year', GENERAL_PAGE, 83263, '15_From-school-to-VET.xlsx', '15_From-school-to-VET.xlsx', XLSX,
            '2026-10-16T16:52:07Z'),
    _source('geostat_education_school_to_vet_sen', 'Persons with Special Educational Needs who Have Completed Basic Education, Enrolled '
            'in Vocational Education Institutions', GENERAL_PAGE, 83265, '16_VET_Disabled.xlsx', '16_VET_Disabled.xlsx', XLSX,
            '2026-10-16T16:52:09Z'),
    # Archived only: vocational education (category 60).
    _source('geostat_education_vet_institutions', 'Number of educational institutions, that conducted admission of students in '
            'vocational education programs', VOCATIONAL_PAGE, 77194,
            'Number-of-educational-institutions%2C-that-conducted-admission-of-students-in-vocational-education-programs.xlsx',
            'Number-of-educational-institutions,-that-conducted-admission-of-students-in-vocational-education-programs.xlsx', XLSX,
            '2026-10-16T16:52:29Z'),
    _source('geostat_education_vet_regions_sex', 'Indicators of Vocational Education by Regions and Sex', VOCATIONAL_PAGE, 77196,
            'Indicators-of-Vocational-Education-by-Regions-and-Sex.XLSX', 'Indicators-of-Vocational-Education-by-Regions-and-Sex.XLSX',
            XLSX, '2026-10-16T16:52:33Z'),
    _source('geostat_education_vet_employees', 'Number of employees in public an private educational institutions', VOCATIONAL_PAGE, 77197,
            'Number-of-employees-in-public-an-private-educational-institutions.xlsx',
            'Number-of-employees-in-public-an-private-educational-institutions.xlsx', XLSX, '2026-10-16T16:52:34Z'),
    _source('geostat_education_vet_sen', 'Number of Admitted Students with Special Educational Needs by Sex and Regions', VOCATIONAL_PAGE,
            77198, 'Disabled-Student.xlsx', 'Disabled-Student.xlsx', XLSX, '2026-10-16T16:52:36Z'),
    _source('geostat_education_secondary_professional_types', 'General Secondary Professional Schools and Number of Pupils by Type of '
            'studies', VOCATIONAL_PAGE, 27075, 'General-Secondary-Professional-Schools-and-Number-of-Pupils-by-Type.xls',
            'General-Secondary-Professional-Schools-and-Number-of-Pupils-by-Type.xls', XLS, '2026-10-16T16:52:10Z'),
    _source('geostat_education_secondary_professional_private', 'Private Secondary Professional Schools', VOCATIONAL_PAGE, 27076,
            'Private-Secondary-Professional-Schools.xls', 'Private-Secondary-Professional-Schools.xls', XLS, '2026-10-16T16:52:12Z'),
    _source('geostat_education_secondary_professional_specialization', 'Secondary professional schools and enrollment by specialization',
            VOCATIONAL_PAGE, 27077, 'Number-of-Secondary-professional-schools-and-enrollment-by-specialization.xls',
            'Number-of-Secondary-professional-schools-and-enrollment-by-specialization.xls', XLS, '2026-10-16T16:52:14Z'),
    # Category 60 links this second media item under "Number of secondary professional schools by Regions", but it serves a file
    # byte-identical to media 77194 under the same name, so both records point to the one archived copy.
    _source('geostat_education_secondary_professional_regions', 'Number of secondary professional schools by Regions', VOCATIONAL_PAGE,
            77212, 'Number-of-educational-institutions%2C-that-conducted-admission-of-students-in-vocational-education-programs.xlsx',
            'Number-of-educational-institutions,-that-conducted-admission-of-students-in-vocational-education-programs.xlsx', XLSX,
            '2026-10-16T16:52:37Z'),
    _source('geostat_education_secondary_professional_pupils_regions', 'Number of pupils of secondary professional schools by Regions',
            VOCATIONAL_PAGE, 27079, 'Number-of-students-in-secondary-professional-schools.xls',
            'Number-of-students-in-secondary-professional-schools.xls', XLS, '2026-10-16T16:52:17Z'),
    _source('geostat_education_secondary_professional_admitted', 'Number of Students Admitted to Secondary Professional Schools',
            VOCATIONAL_PAGE, 27080, 'Number-of-Students-Admitted-to-Secondary-Professional-Schools.xls',
            'Number-of-Students-Admitted-to-Secondary-Professional-Schools.xls', XLS, '2026-10-16T16:52:19Z'),
    _source('geostat_education_secondary_professional_admitted_specialization', 'Number of students admitted to secondary professional '
            'schools by specialization', VOCATIONAL_PAGE, 27081,
            'Number-of-students-admitted-to-secondary-professional-schools-by-specialization.xls',
            'Number-of-students-admitted-to-secondary-professional-schools-by-specialization.xls', XLS, '2026-10-16T16:52:21Z'),
    _source('geostat_education_secondary_professional_graduates', 'Graduates from Secondary Professional Schools', VOCATIONAL_PAGE, 27082,
            'Graduates-from-Secondary-Professional-Schools.xls', 'Graduates-from-Secondary-Professional-Schools.xls', XLS,
            '2026-10-16T16:52:23Z'),
    _source('geostat_education_secondary_professional_graduates_specialization', 'Graduates from secondary professional schools by '
            'specialization', VOCATIONAL_PAGE, 27083, 'Graduates-from-secondary-professional-schools-by-specialization.xls',
            'Graduates-from-secondary-professional-schools-by-specialization.xls', XLS, '2026-10-16T16:52:25Z'),
    _source('geostat_education_secondary_professional_teachers', 'Number of Teachers of Secondary Professional Schools', VOCATIONAL_PAGE,
            27084, 'Number-of-Teachers-of-Secondary-Professional-Schools.xls', 'Number-of-Teachers-of-Secondary-Professional-Schools.xls',
            XLS, '2026-10-16T16:52:27Z'),
    # Archived only: higher education (category 61).
    _source('geostat_education_higher_subprogrammes', 'Admission, Number of Students and Graduates in Higher Education Institutions by '
            'Sub-Programme and Sex', HIGHER_PAGE, 77161, '02Number-of-students-admitted-in-institutions-by-subprogrammes-and-sex.xlsx',
            '02Number-of-students-admitted-in-institutions-by-subprogrammes-and-sex.xlsx', XLSX, '2026-10-16T16:52:41Z'),
    _source('geostat_education_higher_age_citizenship', 'Number of Students in Institutions by Age, Sex and Citizenship', HIGHER_PAGE,
            77162, '03Number-of-Students-in-Institutions-by-Age%2C-Sex-and-Cityzenship.xlsx',
            '03Number-of-Students-in-Institutions-by-Age,-Sex-and-Cityzenship.xlsx', XLSX, '2026-10-16T16:52:44Z'),
    _source('geostat_education_higher_foreign_students', 'Number of Foreign Students In Institutions by Programmes and Sex', HIGHER_PAGE,
            77173, '04Number-of-Foreign-Students-In-Institutions-by-Programmes-and-Sex.xlsx',
            '04Number-of-Foreign-Students-In-Institutions-by-Programmes-and-Sex.xlsx', XLSX, '2026-10-16T16:52:53Z'),
    _source('geostat_education_higher_abroad', 'Georgian Citizens Studying Abroad and Foreign Students by Sex', HIGHER_PAGE, 77166,
            '05Georgian-Citizens-Studying-Abroad-and-Foreign-Students-by-Sex.xls',
            '05Georgian-Citizens-Studying-Abroad-and-Foreign-Students-by-Sex.xls', XLS, '2026-10-16T16:52:46Z'),
    _source('geostat_education_higher_professors', 'Number of Professors in Higher Education Institutions by Form of Ownership',
            HIGHER_PAGE, 77167, '06Number-of-Professors-in-Higher-Education-Institutions-by-form-of-ownership.xls',
            '06Number-of-Professors-in-Higher-Education-Institutions-by-form-of-ownership.xls', XLS, '2026-10-16T16:52:48Z'),
    _source('geostat_education_higher_institutions', 'Number of Higher Education Institutions by Form of Ownership and Regions of Georgia',
            HIGHER_PAGE, 77168, '07Number-of-Higher-Education-Institutions-by-Form-of-Ownership-and-Regions-of-Georgia.xls',
            '07Number-of-Higher-Education-Institutions-by-Form-of-Ownership-and-Regions-of-Georgia.xls', XLS, '2026-10-16T16:52:50Z'),
    _source('geostat_education_doctoral', 'Admission, Number of Doctoral Students and Graduates by Programme', HIGHER_PAGE, 77190,
            '08_Admission_Number_Graduates.xls', '08_Admission_Number_Graduates.xls', XLS, '2026-10-16T16:52:54Z'),
    _source('geostat_education_doctoral_age', 'Number of Persons Working for Doctoral Degree by Age and Citizenship', HIGHER_PAGE, 77192,
            '9_Number_of_persons_working_for_doctoral_degree_by_age_groups.xls',
            '9_Number_of_persons_working_for_doctoral_degree_by_age_groups.xls', XLS, '2026-10-16T16:52:56Z'),
    _source('geostat_education_doctoral_heads', 'Number of Scientific Heads of Doctoral Candidates', HIGHER_PAGE, 77201,
            '10_Number_of_scientific_heads_of_doctoral_candidates.xls', '10_Number_of_scientific_heads_of_doctoral_candidates.xls', XLS,
            '2026-10-16T16:52:59Z'),
    _source('geostat_education_doctoral_foreign', 'Number of foreign Persons Working for Doctoral Degree by countries', HIGHER_PAGE, 77193,
            '11_Number_of_foreign_Persons_Working_for_Doctoral_Degree_by_countries.xls',
            '11_Number_of_foreign_Persons_Working_for_Doctoral_Degree_by_countries.xls', XLS, '2026-10-16T16:52:58Z'),
    # The category pages the file links come from.
    ('geostat_education_preschool_page', 'Geostat page: early and preschool education (category 58)', PRESCHOOL_PAGE,
     'https://www.geostat.ge/en/modules/categories/58', PRESCHOOL_PAGE, 'official/geostat-category-58-2026-10-16.html', HTML,
     '2026-10-16T16:53:26Z'),
    ('geostat_education_general_page', 'Geostat page: general education (category 59)', GENERAL_PAGE,
     'https://www.geostat.ge/en/modules/categories/59', GENERAL_PAGE, 'official/geostat-category-59-2026-10-16.html', HTML,
     '2026-10-16T16:53:28Z'),
    ('geostat_education_vocational_page', 'Geostat page: professional education (category 60)', VOCATIONAL_PAGE,
     'https://www.geostat.ge/en/modules/categories/60', VOCATIONAL_PAGE, 'official/geostat-category-60-2026-10-16.html', HTML,
     '2026-10-16T16:53:30Z'),
    ('geostat_education_higher_page', 'Geostat page: higher education (category 61)', HIGHER_PAGE,
     'https://www.geostat.ge/en/modules/categories/61', HIGHER_PAGE, 'official/geostat-category-61-2026-10-16.html', HTML,
     '2026-10-16T16:53:31Z'),
]
FILE = {source[0]: source[5] for source in SOURCES}
NATIONAL, TEACHERS, MUNICIPAL = 'geostat_education_schools_national', 'geostat_education_teachers_national', 'geostat_education_municipal'
KINDERGARTENS, HIGHER, VOCATIONAL = 'geostat_education_kindergartens', 'geostat_education_higher', 'geostat_education_vocational'

FIELDS = ['year', 'period_label', 'indicator_id', 'geography_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'shown',
          'source_id', 'source_sheet', 'source_cell']
BREAK_FIELDS = ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note']
GEORGIA = 'country.georgia'

UNITS = {'schools': 'institutions', 'kindergartens': 'institutions', 'pupils_national': 'persons_thousand', 'pupils': 'persons',
         'teachers': 'persons', 'kg_children': 'persons', 'kg_staff': 'persons', 'he_students': 'persons', 'he_admitted': 'persons',
         'he_graduates': 'persons', 'vet_admitted': 'persons', 'vet_graduates': 'persons'}
UNIT_PLACES = {'institutions': 0, 'persons': 0, 'persons_thousand': 1}
ACCOUNTING = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)'  # Shows a zero as "-"; the cell still stores 0.
FORMAT_PLACES = {'#\\ ##0': 0, '#,##0': 0, '0': 0, ACCOUNTING: 0, '0.0': 1, '#,##0.0': 1}
BUILTIN_FORMATS = {0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 49: '@'}
UNAVAILABLE_MARKERS = ('…', '...', '-')
NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
RELATIONSHIP = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
CALC = Context(prec=28)
DISPLAY = Context(prec=15, rounding=ROUND_HALF_UP)  # Excel shows a stored double to 15 significant digits.
FOOTNOTE = re.compile(r'(\*|\d\)|source:|note:)', re.IGNORECASE)  # "* As at 5 April 2011", "1)Actually operating ...", "Source: ..."

# Years each table serves (school years by their starting year; vocational by calendar year).
NATIONAL_YEARS, TEACHER_YEARS = range(2000, 2026), range(2006, 2026)
MUNICIPAL_YEARS, MUNICIPAL_TEACHER_YEARS, KG_YEARS = range(2005, 2026), range(2016, 2026), range(2017, 2026)
HE_YEARS, GRADUATE_YEARS, VET_YEARS = range(2011, 2026), range(2010, 2025), range(2013, 2026)

NATIONAL_ROWS = {  # Table 01 and 06 row labels (spaces collapsed) -> (measure, group)
    NATIONAL: {'General education schools, unit': ('schools', 'total'), 'Public general education schools': ('schools', 'public'),
               'Private general education schools': ('schools', 'private'), 'Number of pupils - thsd.': ('pupils_national', 'total'),
               'In public general education schools': ('pupils_national', 'public'),
               'In private general education schools': ('pupils_national', 'private')},
    TEACHERS: {'Teachers, total': ('teachers', 'total'), 'In Public schools': ('teachers', 'public'),
               'In Private schools': ('teachers', 'private')},
}
NATIONAL_IGNORED = ('of which:', 'of which females')  # Table 06's teachers by sex within ownership are not served.
MUNICIPAL_SHEETS = {'schools': 'schools', 'pupils': 'pupils', 'teachers': 'teachers'}
SEX_COLUMNS = {'total': 'total', 'women': 'women', 'men': 'men'}
KG_COLUMNS = {'the number of pec institutions': 'kindergartens', 'the number of children involved in pec services': 'kg_children',
              'the number of caregiver-pedagogues/caregivers': 'kg_staff',
              'the number of caregiver-pedagogues/caregivers/assistant caregivers/inclusive education special teachers': 'kg_staff'}
KG_STAFF_WIDE = 'the number of caregiver-pedagogues/caregivers/assistant caregivers/inclusive education special teachers'
KG_STAFF_FROM = 2020  # The widened staff heading is printed from 2020/21 on (series break kindergarten_staff_2020).
# Geography units that some tables do not print (they only had values before 2011).
EARLY_UNITS = ('unit.eredvi', 'unit.tighva', 'unit.kurta')
# Units kept apart from the 63 municipalities: their region (Abkhazia AR adds to Georgia directly).
UNIT_REGIONS = {'unit.akhalgori': 'region.mtskheta_mtianeti', 'unit.eredvi': 'region.shida_kartli',
                'unit.tighva': 'region.shida_kartli', 'unit.kurta': 'region.shida_kartli'}


def _years(first, last):
    return set(range(first, last + 1))


# Every cell in a served range that prints '…', '...' or nothing; any other unavailable cell, or a value in one of
# these, stops preparation. No row is written for these cells.
UNAVAILABLE = {
    ('education.teachers.private', GEORGIA): {2010},  # Table 06 F7 '...'
    ('education.schools.total', 'unit.akhalgori'): _years(2009, 2025),
    ('education.pupils.total', 'unit.akhalgori'): _years(2009, 2025),
    ('education.schools.total', 'unit.eredvi'): {2008} | _years(2011, 2025),
    ('education.pupils.total', 'unit.eredvi'): {2008} | _years(2011, 2025),
    **{(f'education.{measure}.total', unit): _years(2008, 2025) for measure in ('schools', 'pupils') for unit in ('unit.tighva', 'unit.kurta')},
    **{(f'education.teachers.{group}', 'unit.akhalgori'): _years(2016, 2025) for group in ('total', 'women', 'men')},
    **{(f'education.{measure}.total', 'unit.abkhazia_ar'): _years(2017, 2025) for measure in ('kindergartens', 'kg_children', 'kg_staff')},
}

HE_SHEETS = {'Number': 'he_students', 'Admission': 'he_admitted', 'Graduates': 'he_graduates'}
HE_TOTAL_LABELS = {'Number': 'Number of students, total', 'Admission': 'Number of students admitted, total', 'Graduates': 'Graduates , total'}
HE_FIELDS = {'Education': 'field_education', 'Humanities and Arts': 'field_humanities_arts',
             'Social sciences, business and law': 'field_social_business_law', 'Science': 'field_science',
             'Engineering, manufacturing and construction': 'field_engineering', 'Agriculture': 'field_agriculture',
             'Health and welfare': 'field_health_welfare', 'Services': 'field_services'}
HE_LEVELS = {'bachelor or certified physician programme': ('level_bachelor', 'old'), 'magistracy or residency': ('level_master', 'old'),
             'bachelor programme': ('level_bachelor', 'new'),
             'magistracy, certified physician (veterinarian) or residency': ('level_master', 'new'),
             'professional programme': ('level_professional', None)}
HE_LEVELS_FROM = 2015  # Stored year from which the ISCED 2011 headings are printed (graduates: from "2015 year", stored 2014).
HE_GROUPS = ['total', 'level_bachelor', 'level_master', 'level_professional', 'public', 'private', 'women', 'men', *HE_FIELDS.values()]

VET_MEASURES = {'number of admitted students': 'vet_admitted', 'number of graduated students': 'vet_graduates'}
VET_FIELDS = {  # Geostat's current list (served) and the list it phased out over 2019-2022 (kept with shown=false).
    'Agriculture, forestry, fisheries, veterinary': 'field_agriculture_vet', 'Art, humanitarian sciences': 'field_arts_humanities',
    'Business, Administration and Law': 'field_business_law', 'Education': 'field_education',
    'Engineering, Manufacturing, Construction': 'field_engineering', 'Health, Social welfare': 'field_health_welfare',
    'ICT': 'field_ict', 'Services': 'field_services', 'Social Sciences, Journalism and information': 'field_social_journalism',
    'Agricultural Sciences': 'old_agricultural_sciences', 'Business Administration': 'old_business_administration',
    'Engineering': 'old_engineering', 'Science / Natural Sciences': 'old_natural_sciences',
    'Inter directional branches and specialties': 'old_inter_directional', 'Law': 'old_law', 'Social Sciences': 'old_social_sciences',
    'Art': 'old_art', 'Health': 'old_health'}
# A field's active span: the first to the last year in which either measure is non-zero. Geostat prints 0 outside it; those
# cells produce no row. The spans are recorded here and must match the workbook.
VET_SPANS = {
    'field_agriculture_vet': (2019, 2025), 'field_arts_humanities': (2019, 2025), 'field_business_law': (2019, 2025),
    'field_education': (2016, 2025), 'field_engineering': (2019, 2025), 'field_health_welfare': (2019, 2025), 'field_ict': (2019, 2025),
    'field_services': (2019, 2025), 'field_social_journalism': (2020, 2025),
    'old_agricultural_sciences': (2013, 2022), 'old_business_administration': (2013, 2022), 'old_engineering': (2013, 2022),
    'old_natural_sciences': (2013, 2019), 'old_inter_directional': (2013, 2022), 'old_law': (2013, 2020),
    'old_social_sciences': (2013, 2022), 'old_art': (2013, 2022), 'old_health': (2013, 2022)}
VET_CURRENT_FROM, VET_CURRENT_ONLY_FROM = 2019, 2023  # Geostat's current field list starts in 2019 and alone adds up from 2023.
VET_AGE_ROW = re.compile(r'<\d+|\d+-\d+|\d+ or more')

ANCHORS = {
    ('education.schools.total', GEORGIA, 2025): '2292', ('education.schools.private', GEORGIA, 2025): '206',
    ('education.pupils_national.total', GEORGIA, 2025): '644.2', ('education.pupils.total', 'region.tbilisi', 2025): '232134',
    ('education.teachers.total', GEORGIA, 2025): '66328', ('education.kindergartens.total', GEORGIA, 2025): '1717',
    ('education.kg_children.total', GEORGIA, 2025): '130337', ('education.kg_staff.total', GEORGIA, 2025): '19176',
    ('education.he_students.total', GEORGIA, 2025): '195426', ('education.he_admitted.total', GEORGIA, 2025): '58554',
    ('education.he_graduates.total', GEORGIA, 2024): '32494', ('education.vet_admitted.total', GEORGIA, 2025): '19690',
    ('education.vet_graduates.total', GEORGIA, 2025): '10537'}
MUNICIPAL_GEORGIA_PUPILS_2025 = Decimal(644243)


# --- Reading -------------------------------------------------------------------------------------------------------

def column_number(column):
    number = 0
    for letter in column:
        number = number * 26 + ord(letter) - 64
    return number


@functools.lru_cache(maxsize=None)
def sheet(source_id, name):
    """{row: {column: cell}} with each cell's text or exact decimal token, its type and its number format."""
    with ZipFile(ROOT / FILE[source_id]) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        matching = [s for s in workbook.findall('x:sheets/x:sheet', NS) if s.get('name') == name]
        if len(matching) != 1:
            raise ValueError(f'Expected one sheet {name!r} in {FILE[source_id]}')
        relations = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.get('Target') for r in relations if r.get('Id') == matching[0].get(RELATIONSHIP))
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.iter(f'{{{NS["x"]}}}t'))
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('x:si', NS)]
        styles = ET.fromstring(archive.read('xl/styles.xml'))
        formats = {**BUILTIN_FORMATS, **{int(f.get('numFmtId')): f.get('formatCode') for f in styles.findall('x:numFmts/x:numFmt', NS)}}
        style_formats = [formats.get(int(xf.get('numFmtId', '0')), 'unsupported') for xf in styles.findall('x:cellXfs/x:xf', NS)]
        xml = ET.fromstring(archive.read(target.lstrip('/') if target.startswith('/') else 'xl/' + target))
    rows = defaultdict(dict)
    for cell in xml.findall('x:sheetData/x:row/x:c', NS):
        column, row = re.fullmatch(r'([A-Z]+)(\d+)', cell.get('r')).groups()
        kind, token = cell.get('t', 'n'), cell.find('x:v', NS)
        value = None if token is None else token.text
        if kind == 's' and value is not None:
            value = strings[int(value)]
        elif kind == 'inlineStr':
            value = ''.join(t.text or '' for t in cell.iter(f'{{{NS["x"]}}}t'))
        elif kind == 'n' and value is not None:
            value = Decimal(value)
        if value is not None:
            rows[int(row)][column] = {'value': value, 'cell': cell.get('r'), 'kind': kind, 'format': style_formats[int(cell.get('s', '0'))]}
    return dict(rows)


def text(cell):
    return '' if cell is None else clean(str(cell['value']))


def label(cell):
    return text(cell).casefold()


def token(cell):
    """The exact stored number: a numeric cell's own XML token, or a text cell with its spaces removed."""
    if cell is not None and cell['kind'] == 'n':
        return format(cell['value'], 'f')
    if cell is not None and isinstance(cell['value'], str):
        compact = re.sub(r'\s', '', cell['value'])
        if re.fullmatch(r'-?\d+(\.\d+)?', compact):
            return compact
    raise ValueError(f'Expected a number, found {None if cell is None else cell["value"]!r} in {None if cell is None else cell["cell"]}')


def cell_number(cell):
    return Decimal(token(cell))


def unavailable(cell):
    """True for a cell that prints no value: blank, '…', '...' or '-'."""
    return cell is None or cell['value'] is None or (cell['kind'] != 'n' and text(cell) in UNAVAILABLE_MARKERS)


def displayed(value):
    """The stored double as Excel shows it: 15 significant digits, rounded half-up, trailing zeros dropped."""
    shown = DISPLAY.create_decimal(Decimal(value))
    return format(shown.normalize() if shown != shown.to_integral_value() else shown.quantize(Decimal(1)), 'f')


def published(value, places):
    """Round half-up from the value as Excel displays it (15 significant digits), so 8.4499999999999993 publishes as 8.5."""
    return str(DISPLAY.create_decimal(Decimal(value)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def places_of(cell, unit):
    """Decimals the cell's number format shows, which must be the unit's: one for thousands of pupils, none for counts.
    A 'General' cell shows its value as stored, so it may not hold more decimals than the unit has."""
    number_format = cell['format']
    if number_format in FORMAT_PLACES:
        places = FORMAT_PLACES[number_format]
    elif number_format == 'General':
        shown, places = displayed(token(cell)), UNIT_PLACES[unit]
        if '.' in shown and len(shown.split('.')[1]) > places:
            raise ValueError(f'{cell["cell"]} shows {shown}, more decimals than {unit} has')
    else:
        raise ValueError(f'Unexpected number format {number_format!r} in {cell["cell"]}')
    if places != UNIT_PLACES[unit]:
        raise ValueError(f'{cell["cell"]} shows {places} decimals, not the {UNIT_PLACES[unit]} of {unit}')
    return places


def school_year(heading):
    """'2025/2026', '2010/2011*' or '2025-2026 school year' -> 2025."""
    match = re.fullmatch(r'(\d{4})/(\d{4})\*?|(\d{4})-(\d{4}) school year', heading)
    if not match:
        return None
    first, second = (int(g) for g in match.groups() if g)
    if second != first + 1:
        raise ValueError(f'Odd school year heading {heading!r}')
    return first


def graduate_year(heading):
    """Graduates of calendar year Y ('2025 year') are stored under the school year they end, Y-1 (2024/25)."""
    match = re.fullmatch(r'(\d{4}) year', heading)
    return int(match.group(1)) - 1 if match else None


def period_label(measure, year):
    return str(year) if measure.startswith('vet_') else f'{year}/{(year + 1) % 100:02d}'


def year_row(rows, parse, within=None):
    """The one heading row (inside `within`, if given) whose cells parse as years: (row number, {year: column})."""
    found = []
    for number in sorted(within if within is not None else rows):
        years = {}
        for column, cell in rows.get(number, {}).items():
            year = parse(cell)
            if year is not None:
                if year in years:
                    raise ValueError(f'Year {year} is printed twice in row {number}')
                years[year] = column
        if years:
            found.append((number, years))
    if len(found) != 1:
        raise ValueError(f'Expected one year heading row, found {[n for n, _ in found]}')
    return found[0]


def heading_year(parse):
    return lambda cell: parse(text(cell)) if cell is not None and cell['kind'] != 'n' else None


def span_columns(rows, number, start, end):
    """The labelled columns of heading row `number` from column `start` up to, not including, column `end`."""
    return {label(cell): column for column, cell in rows.get(number, {}).items()
            if column_number(start) <= column_number(column) < (column_number(end) if end else 10 ** 6)}


def year_spans(years):
    """Each year's first column and the next year's first column (None for the last)."""
    ordered = sorted(years.items(), key=lambda item: column_number(item[1]))
    return {year: (column, ordered[i + 1][1] if i + 1 < len(ordered) else None) for i, (year, column) in enumerate(ordered)}


# --- Places -----------------------------------------------------------------------------------------------------------

def load_units():
    with open(UNITS_FILE, encoding='utf-8-sig', newline='') as handle:
        rows = list(csv.DictReader(handle))
    units = {row['source_label']: row['geography_id'] for row in rows}
    if len(units) != len(rows):
        raise ValueError('A label is listed twice in units.csv')
    return units


@functools.lru_cache(maxsize=None)
def municipal_regions():
    with open(MUNICIPALITIES_FILE, encoding='utf-8-sig', newline='') as handle:
        return {row['municipality_code']: row['region_id'] for row in csv.DictReader(handle)}


def region_of(geography_id):
    """The region a municipality or kept unit belongs to; None for Georgia, regions and Abkhazia AR (which adds to Georgia)."""
    if geography_id.isdigit():
        return municipal_regions()[geography_id]
    return UNIT_REGIONS.get(geography_id)


def unit_rows(source_id, name, first_row, units):
    """{geography_id: row} for every unit row of a place table, below the headings, by its printed label in column A.
    A label units.csv does not list stops; so does a code printed twice or a unit printed under another region."""
    rows, found, region = sheet(source_id, name), {}, None
    for number in sorted(n for n in rows if n >= first_row):
        name_cell = rows[number].get('A')
        printed = text(name_cell)
        if not printed or FOOTNOTE.match(printed):
            continue
        if printed not in units:
            raise ValueError(f'{printed!r} ({name} A{number}) is not in units.csv')
        geography_id = units[printed]
        if geography_id in found:
            raise ValueError(f'{geography_id} is printed twice in {name} (A{found[geography_id]} and A{number})')
        if geography_id == '04':
            raise ValueError('Tbilisi must map to region.tbilisi, never to municipal code 04')
        found[geography_id] = number
        if geography_id.startswith('region.'):
            region = geography_id
        elif geography_id in (GEORGIA, 'unit.abkhazia_ar'):
            region = None
        elif region_of(geography_id) != region:
            raise ValueError(f'{printed!r} is printed under {region}, not under {region_of(geography_id)}')
    return found


def expected_units(units, table):
    ids = set(units.values())
    if table in ('teachers', 'kindergartens'):
        ids -= set(EARLY_UNITS)
    return ids


# --- Observations -----------------------------------------------------------------------------------------------------

def observation(measure, group, geography_id, year, cell, source_id, source_sheet):
    unit = UNITS[measure]
    value = token(cell)
    return {'year': year, 'period_label': period_label(measure, year), 'indicator_id': f'education.{measure}.{group}',
            'geography_id': geography_id, 'value': value, 'published_value': published(value, places_of(cell, unit)), 'unit': unit,
            'basis': 'actual', 'value_status': 'official', 'shown': 'false' if group.startswith('old_') else 'true',
            'source_id': source_id, 'source_sheet': source_sheet, 'source_cell': cell['cell']}


def take(rows, measure, group, geography_id, year, cell, source_id, source_sheet):
    """Append the cell's observation, or nothing for a cell recorded as unavailable; anything else stops."""
    expected_gap = year in UNAVAILABLE.get((f'education.{measure}.{group}', geography_id), ())
    if unavailable(cell):
        if not expected_gap:
            raise ValueError(f'{source_sheet} {cell["cell"] if cell else "blank"}: no value for {measure}.{group} {geography_id} {year}')
        return
    if expected_gap:
        raise ValueError(f'{source_sheet} {cell["cell"]}: a value where none was recorded ({measure}.{group} {geography_id} {year})')
    rows.append(observation(measure, group, geography_id, year, cell, source_id, source_sheet))


def blank(column, number):
    return {'value': None, 'cell': f'{column}{number}', 'kind': 'blank', 'format': None}


def at(rows, column, number):
    return rows.get(number, {}).get(column)


def national_tables():
    """Tables 01 and 06: {source: (years, {(measure, group): row})}, rows found by label below the year headings."""
    tables = {}
    for source_id, labels in NATIONAL_ROWS.items():
        rows = sheet(source_id, '1')
        heading, years = year_row(rows, heading_year(school_year))
        found = {}
        for number in sorted(n for n in rows if n > heading):
            printed = text(rows[number].get('A'))
            if not printed or printed.casefold() in NATIONAL_IGNORED or FOOTNOTE.match(printed):
                continue
            if printed not in labels or labels[printed] in found:
                raise ValueError(f'Unexpected row {printed!r} in {FILE[source_id]}')
            found[labels[printed]] = number
        if set(found) != set(labels.values()):
            raise ValueError(f'Missing rows in {FILE[source_id]}: {set(labels.values()) - set(found)}')
        tables[source_id] = (years, found)
    return tables


def national_observations():
    out = []
    for source_id, (years, found) in national_tables().items():
        served = NATIONAL_YEARS if source_id == NATIONAL else TEACHER_YEARS
        if sorted(years) != list(served):
            raise ValueError(f'{FILE[source_id]} does not run {served.start}-{served.stop - 1}: {sorted(years)}')
        rows = sheet(source_id, '1')
        for (measure, group), number in found.items():
            for year in served:
                cell = at(rows, years[year], number) or blank(years[year], number)
                take(out, measure, group, GEORGIA, year, cell, source_id, '1')
    return out


@functools.lru_cache(maxsize=None)
def municipal_table(name, units_key):
    """Table 11 sheet: (years -> {group: column}, {geography: row})."""
    units = dict(units_key)
    rows = sheet(MUNICIPAL, name)
    heading, years = year_row(rows, heading_year(school_year))
    if name == 'teachers':
        columns = {}
        for year, (start, end) in year_spans(years).items():
            found = span_columns(rows, heading + 1, start, end)
            if set(found) != set(SEX_COLUMNS) or found['total'] != start:
                raise ValueError(f'Unexpected Total/Women/Men headings under {year} in {name}')
            columns[year] = {SEX_COLUMNS[key]: column for key, column in found.items()}
        first = heading + 2
    else:
        columns = {year: {'total': column} for year, column in years.items()}
        first = heading + 1
    served = MUNICIPAL_TEACHER_YEARS if name == 'teachers' else MUNICIPAL_YEARS
    if sorted(columns) != list(served):
        raise ValueError(f'Sheet {name} does not run {served.start}-{served.stop - 1}: {sorted(columns)}')
    places, expected = unit_rows(MUNICIPAL, name, first, units), expected_units(units, 'teachers' if name == 'teachers' else 'municipal')
    if set(places) != expected:
        raise ValueError(f'Unexpected units in sheet {name}: {sorted(set(places) ^ expected)}')
    return columns, places


def municipal_observations(units):
    out = []
    for measure, name in MUNICIPAL_SHEETS.items():
        columns, places = municipal_table(name, tuple(sorted(units.items())))
        rows = sheet(MUNICIPAL, name)
        for geography_id, number in places.items():
            for year, groups in columns.items():
                for group, column in groups.items():
                    # Georgia's schools, pupils and teachers total come from the national tables; this row is a cross-check.
                    if geography_id == GEORGIA and group == 'total':
                        continue
                    take(out, measure, group, geography_id, year, at(rows, column, number) or blank(column, number), MUNICIPAL, name)
    return out


@functools.lru_cache(maxsize=None)
def kindergarten_table(units_key):
    units = dict(units_key)
    rows = sheet(KINDERGARTENS, '1')
    heading, years = year_row(rows, heading_year(school_year))
    columns = {}
    for year, (start, end) in year_spans(years).items():
        found = span_columns(rows, heading + 1, start, end)
        measures = {KG_COLUMNS.get(key): column for key, column in found.items()}
        if None in measures or len(measures) != 3 or min(found.values(), key=column_number) != start:
            raise ValueError(f'Unexpected kindergarten headings under {year}: {list(found)}')
        if (KG_STAFF_WIDE in found) != (year >= KG_STAFF_FROM):
            raise ValueError(f'The staff heading under {year} is not the one recorded for the kindergarten_staff_2020 break')
        columns[year] = measures
    if sorted(columns) != list(KG_YEARS):
        raise ValueError(f'The kindergarten table does not run 2017-2025: {sorted(columns)}')
    places = unit_rows(KINDERGARTENS, '1', heading + 2, units)
    if set(places) != expected_units(units, 'kindergartens'):
        raise ValueError(f'Unexpected units in the kindergarten table: {sorted(set(places) ^ expected_units(units, "kindergartens"))}')
    return columns, places


def kindergarten_observations(units):
    out = []
    columns, places = kindergarten_table(tuple(sorted(units.items())))
    rows = sheet(KINDERGARTENS, '1')
    for geography_id, number in places.items():
        for year, measures in columns.items():
            for measure, column in measures.items():
                take(out, measure, 'total', geography_id, year, at(rows, column, number) or blank(column, number), KINDERGARTENS, '1')
    return out


def he_block_kind(title):
    title = title.casefold()
    if 'public and private institutions' in title:
        return 'all'
    if 'public institutions' in title:
        return 'public'
    if 'private institutions' in title:
        return 'private'
    return None


@functools.lru_cache(maxsize=None)
def he_blocks(name):
    """One sheet of the higher-education workbook: {kind: (years -> {column role: column}, {row role: row})} for the
    "Public and Private", "Public" and "Private" blocks, each opened by its title in column A."""
    rows = sheet(HIGHER, name)
    parse = graduate_year if name == 'Graduates' else school_year
    titles = [(n, he_block_kind(text(cells.get('A')))) for n, cells in sorted(rows.items())
              if 'institutions by programmes and sex' in label(cells.get('A'))]
    if [kind for _, kind in titles] != ['all', 'public', 'private']:
        raise ValueError(f'Unexpected blocks in {name}: {titles}')
    blocks = {}
    for i, (start, kind) in enumerate(titles):
        end = titles[i + 1][0] if i + 1 < len(titles) else max(rows) + 1
        heading, years = year_row(rows, heading_year(parse), within=range(start + 1, start + 3))
        columns = {}
        for year, (first, after) in year_spans(years).items():
            if label(at(rows, first, heading + 1)) != 'total':
                raise ValueError(f'No Total heading under {year} in {name}')
            levels = {}
            for key, column in span_columns(rows, heading + 2, first, after).items():
                if key not in HE_LEVELS:
                    raise ValueError(f'Unexpected level heading {key!r} under {year} in {name}')
                level, edition = HE_LEVELS[key]
                if edition is not None and (edition == 'new') != (year >= HE_LEVELS_FROM - (name == 'Graduates')):
                    raise ValueError(f'The {key!r} heading under {year} in {name} is not the one recorded for the he_levels_2015 break')
                levels[level] = column
            if set(levels) != {'level_bachelor', 'level_master', 'level_professional'}:
                raise ValueError(f'Missing level headings under {year} in {name}')
            columns[year] = {'total': first, **levels}
        served = GRADUATE_YEARS if name == 'Graduates' else HE_YEARS
        if sorted(columns) != list(served):
            raise ValueError(f'{name} does not run {served.start}-{served.stop - 1}: {sorted(columns)}')
        found, section = {}, None
        for number in range(heading + 3, end):
            printed = text(rows.get(number, {}).get('A'))
            if not printed or printed.casefold() in ('of which by programmes:',) or FOOTNOTE.match(printed):
                continue
            if printed == HE_TOTAL_LABELS[name] and section is None:
                section, role = 'total', 'total'
            elif printed.casefold() == 'of which females' and section == 'total':
                section, role = 'women', 'women'
            elif printed.casefold() == 'of which males' and section == 'women':
                section, role = 'men', 'men'
            elif printed in HE_FIELDS and section is not None:
                role = HE_FIELDS[printed] if section == 'total' else None  # Fields by sex are not served.
            else:
                raise ValueError(f'Unexpected row {printed!r} in {name} A{number}')
            if role is not None:
                if role in found:
                    raise ValueError(f'{role} is printed twice in a {name} block')
                found[role] = number
        if set(found) != {'total', 'women', 'men', *HE_FIELDS.values()}:
            raise ValueError(f'Missing rows in a {name} block: {sorted(found)}')
        blocks[kind] = (columns, found)
    return blocks


def higher_observations():
    out = []
    for name, measure in HE_SHEETS.items():
        rows, blocks = sheet(HIGHER, name), he_blocks(name)
        columns, found = blocks['all']
        for year, roles in columns.items():
            cells = {group: (roles[group], found['total']) for group in ('total', 'level_bachelor', 'level_master', 'level_professional')}
            cells.update({group: (roles['total'], found[group]) for group in ('women', 'men', *HE_FIELDS.values())})
            for kind in ('public', 'private'):
                kind_columns, kind_rows = blocks[kind]
                cells[kind] = (kind_columns[year]['total'], kind_rows['total'])
            for group in HE_GROUPS:
                column, number = cells[group]
                take(out, measure, group, GEORGIA, year, at(rows, column, number) or blank(column, number), HIGHER, name)
    return out


@functools.lru_cache(maxsize=None)
def vocational_table():
    """(year -> measure -> {total, women, men: column}, {role: row}) for the vocational sheet."""
    rows = sheet(VOCATIONAL, '1')
    heading, years = year_row(rows, lambda cell: int(cell['value']) if cell is not None and cell['kind'] == 'n' and
                              re.fullmatch(r'20\d\d', token(cell)) and cell['format'] == 'General' else None, within=range(1, 4))
    columns = {}
    for year, (start, end) in year_spans(years).items():
        measures = span_columns(rows, heading + 1, start, end)
        if set(measures) != set(VET_MEASURES) or measures['number of admitted students'] != start:
            raise ValueError(f'Unexpected measure headings under {year}: {list(measures)}')
        ordered = sorted(measures.items(), key=lambda item: column_number(item[1]))
        columns[year] = {}
        for i, (key, first) in enumerate(ordered):
            after = ordered[i + 1][1] if i + 1 < len(ordered) else end
            sexes = span_columns(rows, heading + 2, first, after)
            if set(sexes) != set(SEX_COLUMNS) or sexes['total'] != first:
                raise ValueError(f'Unexpected Total/Women/Men headings under {year} {key}')
            columns[year][VET_MEASURES[key]] = {SEX_COLUMNS[s]: column for s, column in sexes.items()}
    if sorted(columns) != list(VET_YEARS):
        raise ValueError(f'The vocational table does not run 2013-2025: {sorted(columns)}')
    found, ages = {}, False
    for number in sorted(n for n in rows if n > heading + 2):
        printed = text(rows[number].get('A'))
        if not printed or FOOTNOTE.match(printed) or printed.casefold() == 'of which by programmes':
            continue
        if printed.casefold() == 'of which:':
            ages = True  # Age groups follow; they are archived, not served.
            continue
        if ages and VET_AGE_ROW.fullmatch(printed):
            continue
        role = 'total' if printed == 'Number of Students, total' and not found else VET_FIELDS.get(printed) if not ages else None
        if role is None or role in found:
            raise ValueError(f'Unexpected row {printed!r} in the vocational table (A{number})')
        found[role] = number
    if set(found) != {'total', *VET_FIELDS.values()}:
        raise ValueError(f'Missing rows in the vocational table: {sorted(found)}')
    return columns, found


def vocational_observations():
    out = []
    rows = sheet(VOCATIONAL, '1')
    columns, found = vocational_table()
    for year, measures in columns.items():
        for measure, sexes in measures.items():
            for group in ('total', 'women', 'men'):
                column = sexes[group]
                take(out, measure, group, GEORGIA, year, at(rows, column, found['total']) or blank(column, found['total']), VOCATIONAL, '1')
    for field, number in found.items():
        if field == 'total':
            continue
        active = [year for year, measures in columns.items()
                  if any(cell_number(at(rows, sexes['total'], number)) != 0 for sexes in measures.values())]
        if (min(active), max(active)) != VET_SPANS[field]:
            raise ValueError(f'{field} is active {min(active)}-{max(active)}, not the recorded {VET_SPANS[field]}')
        for year in range(VET_SPANS[field][0], VET_SPANS[field][1] + 1):
            for measure, sexes in columns[year].items():
                take(out, measure, field, GEORGIA, year, at(rows, sexes['total'], number), VOCATIONAL, '1')
    return out


def extract(units=None):
    """Every served observation, transcribed from its original cell."""
    units = load_units() if units is None else units
    if len(set(units.values())) != len(units):
        duplicated = sorted({g for g in units.values() if list(units.values()).count(g) > 1})
        raise ValueError(f'{duplicated} would be printed twice: more than one units.csv label maps to it')
    return (national_observations() + municipal_observations(units) + kindergarten_observations(units) + higher_observations()
            + vocational_observations())


def georgia_row_values(measure, group):
    """The GEORGIA row of the place table a measure comes from (table 11 or the kindergarten table), {year: value}."""
    units = load_units()
    key = tuple(sorted(units.items()))
    if measure in MUNICIPAL_SHEETS:
        name = MUNICIPAL_SHEETS[measure]
        columns, places = municipal_table(name, key)
        rows = sheet(MUNICIPAL, name)
        return {year: cell_number(at(rows, groups[group], places[GEORGIA])) for year, groups in columns.items()}
    columns, places = kindergarten_table(key)
    rows = sheet(KINDERGARTENS, '1')
    return {year: cell_number(at(rows, measures[measure], places[GEORGIA])) for year, measures in columns.items()}


# --- Validation ---------------------------------------------------------------------------------------------------------

def expected_keys(units=None):
    units = load_units() if units is None else units
    keys = set()

    def add(indicator_id, geography_id, years):
        keys.update((indicator_id, geography_id, year) for year in years
                    if year not in UNAVAILABLE.get((indicator_id, geography_id), ()))

    for measure in ('schools', 'pupils_national'):
        for group in ('total', 'public', 'private'):
            add(f'education.{measure}.{group}', GEORGIA, NATIONAL_YEARS)
    for group in ('total', 'public', 'private'):
        add(f'education.teachers.{group}', GEORGIA, TEACHER_YEARS)
    for geography_id in expected_units(units, 'municipal') - {GEORGIA}:
        add('education.schools.total', geography_id, MUNICIPAL_YEARS)
        add('education.pupils.total', geography_id, MUNICIPAL_YEARS)
    for geography_id in expected_units(units, 'teachers'):
        for group in ('women', 'men') if geography_id == GEORGIA else ('total', 'women', 'men'):
            add(f'education.teachers.{group}', geography_id, MUNICIPAL_TEACHER_YEARS)
    for geography_id in expected_units(units, 'kindergartens'):
        for measure in ('kindergartens', 'kg_children', 'kg_staff'):
            add(f'education.{measure}.total', geography_id, KG_YEARS)
    for measure in HE_SHEETS.values():
        for group in HE_GROUPS:
            add(f'education.{measure}.{group}', GEORGIA, GRADUATE_YEARS if measure == 'he_graduates' else HE_YEARS)
    for measure in VET_MEASURES.values():
        for group in ('total', 'women', 'men'):
            add(f'education.{measure}.{group}', GEORGIA, VET_YEARS)
        for field, (first, last) in VET_SPANS.items():
            add(f'education.{measure}.{field}', GEORGIA, range(first, last + 1))
    return keys


def source_cell(row):
    column, number = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
    return sheet(row['source_id'], row['source_sheet']).get(int(number), {}).get(column)


def known_differences():
    """Reviewed mismatches (data/mappings/education/known-differences.csv), if any: each must recur exactly."""
    if not KNOWN_DIFFERENCES_FILE.exists():
        return []
    with open(KNOWN_DIFFERENCES_FILE, encoding='utf-8-sig', newline='') as handle:
        return [{**row, 'year': int(row['year'])} for row in csv.DictReader(handle)]


def mismatches(values, rows):
    """Every part-total comparison the brief names, as [(check, year, parts minus total)] for those that do not add up."""
    found, indexed = [], defaultdict(dict)
    for (indicator_id, geography_id, year), value in values.items():
        indexed[(indicator_id, geography_id)][year] = value

    def series(indicator_id, geography_id=GEORGIA):
        return indexed.get((indicator_id, geography_id), {})

    def compare(name, parts, total, tolerance=Decimal(0), missing_is_zero=False):
        for year, value in sorted(total.items()):
            if missing_is_zero:
                summed = sum(part.get(year, Decimal(0)) for part in parts)
            elif all(year in part for part in parts):
                summed = sum(part[year] for part in parts)
            else:
                continue  # A part is unavailable that year (table 06 private teachers 2010/11).
            if abs(summed - value) > tolerance:
                found.append((name, year, str(summed - value)))

    for measure in ('schools', 'pupils_national', 'teachers'):
        compare(f'{measure} public+private', [series(f'education.{measure}.public'), series(f'education.{measure}.private')],
                series(f'education.{measure}.total'), Decimal('0.15') if measure == 'pupils_national' else Decimal(0))
    for geography_id in sorted({g for (i, g) in indexed if i == 'education.teachers.women'}):
        compare(f'teachers sex {geography_id}', [series(f'education.teachers.{g}', geography_id) for g in ('women', 'men')],
                {y: v for y, v in series('education.teachers.total', geography_id).items() if y in MUNICIPAL_TEACHER_YEARS})
    for measure in HE_SHEETS.values():
        total = series(f'education.{measure}.total')
        for name, groups in (('ownership', ('public', 'private')), ('sex', ('women', 'men')),
                             ('levels', ('level_bachelor', 'level_master', 'level_professional')), ('fields', HE_FIELDS.values())):
            compare(f'{measure} {name}', [series(f'education.{measure}.{g}') for g in groups], total)
    for measure in VET_MEASURES.values():
        total = series(f'education.{measure}.total')
        compare(f'{measure} sex', [series(f'education.{measure}.{g}') for g in ('women', 'men')], total)
        # Outside its span a field prints 0, so a missing year counts as zero here.
        compare(f'{measure} fields', [series(f'education.{measure}.{f}') for f in VET_SPANS], total, missing_is_zero=True)
        current = [series(f'education.{measure}.{f}') for f in VET_SPANS if f.startswith('field_')]
        compare(f'{measure} current fields', current, {y: v for y, v in total.items() if y >= VET_CURRENT_ONLY_FROM}, missing_is_zero=True)
    units = load_units()
    regions = sorted(g for g in set(units.values()) if g.startswith('region.'))
    sources = {(r['indicator_id'], r['geography_id']): r['source_id'] for r in rows}
    for measure in ('schools', 'pupils', 'teachers', 'kindergartens', 'kg_children', 'kg_staff'):
        for group in ('total', 'women', 'men') if measure == 'teachers' else ('total',):
            indicator_id = f'education.{measure}.{group}'
            for region in regions:
                members = [g for g in set(units.values()) if region_of(g) == region]
                if members:  # Tbilisi prints no municipalities.
                    compare(f'{indicator_id} {region}', [series(indicator_id, g) for g in members], series(indicator_id, region),
                            missing_is_zero=True)
            served = sources.get((indicator_id, GEORGIA)) in (MUNICIPAL, KINDERGARTENS)
            georgia = series(indicator_id) if served else georgia_row_values(measure, group)
            compare(f'{indicator_id} georgia', [series(indicator_id, g) for g in regions + ['unit.abkhazia_ar']], georgia,
                    missing_is_zero=True)
    return found


def cross_checks(values):
    """Table 11's own GEORGIA row against the national tables; returns the number of years compared."""
    compared = 0
    national_pupils = {y: v for (i, g, y), v in values.items() if (i, g) == ('education.pupils_national.total', GEORGIA)}
    for year, value in georgia_row_values('pupils', 'total').items():
        if published(CALC.divide(value, 1000), 1) != published(national_pupils[year], 1):
            raise ValueError(f'Table 11 Georgia pupils / 1000 do not round to table 01 in {year}')
        compared += 1
    for measure, first in (('schools', MUNICIPAL_YEARS.start), ('teachers', MUNICIPAL_TEACHER_YEARS.start)):
        for year, value in georgia_row_values(measure, 'total').items():
            if year >= first and value != values[(f'education.{measure}.total', GEORGIA, year)]:
                raise ValueError(f'Table 11 Georgia {measure} differ from the national table in {year}')
            compared += 1
    if georgia_row_values('pupils', 'total')[2025] != MUNICIPAL_GEORGIA_PUPILS_2025:
        raise ValueError('The anchor value does not match Geostat: table 11 Georgia pupils 2025')
    return compared


def validate(rows):
    keys, values, units = set(), {}, load_units()
    for row in rows:
        key = (row['indicator_id'], row['geography_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        measure, group = row['indicator_id'].split('.')[1:]
        if (row['unit'], row['basis'], row['value_status']) != (UNITS[measure], 'actual', 'official'):
            raise ValueError(f'Unexpected unit or status: {key}')
        if row['period_label'] != period_label(measure, row['year']) or row['shown'] != ('false' if group.startswith('old_') else 'true'):
            raise ValueError(f'Unexpected period label or shown flag: {key}')
        cell = source_cell(row)
        if cell is None or unavailable(cell) or published(Decimal(row['value']), places_of(cell, row['unit'])) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        values[key] = Decimal(row['value'])
    expected = expected_keys(units)
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')
    found = mismatches(values, rows)
    recorded = sorted((d['check'], d['year'], d['difference']) for d in known_differences())
    if sorted(found) != recorded:
        unexplained = sorted(set(found) - set(recorded)) or sorted(set(recorded) - set(found))
        raise ValueError(f'Parts do not add up to the total as recorded: {unexplained[:5]}')
    compared = cross_checks(values)
    for (indicator_id, geography_id, year), expected_value in ANCHORS.items():
        if published(values[(indicator_id, geography_id, year)], UNIT_PLACES[UNITS[indicator_id.split('.')[1]]]) != expected_value:
            raise ValueError(f'The anchor value does not match Geostat: {indicator_id} {geography_id} {year}')
    for row in rows:
        if token(source_cell(row)) != row['value']:
            raise ValueError(f'The value does not match its source cell: {row["indicator_id"]} {row["geography_id"]} {row["year"]}')
    return {'cross_check_years': compared, 'mismatches': found}


# --- Outputs ----------------------------------------------------------------------------------------------------------

def manifest():
    records = []
    for source_id, title, page, url, resolved, local_file, content_type, retrieved_at in SOURCES:
        data = (ROOT / local_file).read_bytes()
        records.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': page,
                        'retrieved_file_url': url, 'resolved_file_url': resolved, 'retrieved_at': retrieved_at,
                        'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                        'content_type': content_type})
    return records


def breaks(indicators):
    staff = [i for i in indicators if i.startswith('education.kg_staff.')]
    levels = [i for i in indicators if i.startswith('education.he_') and i.endswith(('.level_bachelor', '.level_master'))]
    graduate_levels = [i for i in levels if i.startswith('education.he_graduates.')]
    school_year_levels = [i for i in levels if i not in graduate_levels]
    kg_url = _media(75474, 'Indicators-on-Public-Preschool-Education-and-Care-%28PEC%29-Institutions.xlsx')[0]
    he_url = _media(77160, '01Number-of-Students-Admission-Graduates-by-Programmes-and-Sex.xlsx')[0]
    return [
        {'break_id': 'kindergarten_staff_2020', 'applies_to': ';'.join(sorted(staff)), 'reference_date': '2020-09-01',
         'reason': 'From 2020/21 Geostat counts more kinds of kindergarten staff. Its staff column is headed "The number of '
                   'caregiver-pedagogues/caregivers" for 2017/18-2019/20 and "The number of caregiver-pedagogues/caregivers/'
                   'assistant caregivers/Inclusive education special teachers" from 2020/21, so assistant caregivers and '
                   'inclusive-education special teachers are counted from then on. No change may be computed across this point.',
         'source_note': f'Indicators-on-Public-Preschool-Education-and-Care-(PEC)-Institutions.xlsx ({kg_url}), sheet 1, row 3 '
                        'headings (D3 for 2017/18, M3 for 2020/21). Public kindergartens ("1)Actually operating institutions '
                        'during the accounting period").'},
        {'break_id': 'he_levels_2015', 'applies_to': ';'.join(sorted(school_year_levels)), 'reference_date': '2015-09-01',
         'reason': 'From 2015/16 Geostat counts certified physician (veterinarian) programmes and residency at master\'s level, '
                   'following ISCED 2011. Sheet Number, A103: "Note: From 2015-2016 school year in accordance with the '
                   'International Standard Classification of Education (ISCED 2011), certified doctor (veterinarian) program, '
                   'residency - are included in the Masters level." The level headings change from "Bachelor or Certified '
                   'physician programme" and "Magistracy or Residency" to "Bachelor programme" and "Magistracy, Certified '
                   'physician (Veterinarian) or Residency". No change may be computed across this point.',
         'source_note': f'01Number-of-Students-Admission-Graduates-by-Programmes-and-Sex.xlsx ({he_url}): the same note in sheet '
                        'Admission (A103, "From 2015/2016 school year"). Graduates are published by calendar year and stored under '
                        'the school year they end, so their change has its own break, he_levels_2015_graduates.'},
        {'break_id': 'he_levels_2015_graduates', 'applies_to': ';'.join(sorted(graduate_levels)), 'reference_date': '2014-09-01',
         'reason': 'From the "2015 year" column (stored as 2014, school year 2014/15) Geostat counts certified physician (veterinarian) programmes and residency at master\'s level, '
                   'following ISCED 2011. Sheet Graduates, A164: "From 2015". The level headings change from "Bachelor or Certified '
                   'physician programme" and "Magistracy or Residency" to "Bachelor programme" and "Magistracy, Certified '
                   'physician (Veterinarian) or Residency". Graduates are stored under the school year they end, so this break is dated '
                   '2014-09-01, a year before he_levels_2015 for students and admitted students. No change may be computed across this point.',
         'source_note': f'01Number-of-Students-Admission-Graduates-by-Programmes-and-Sex.xlsx ({he_url}), sheet Graduates (A164, "From 2015"): '
                        'the new headings start in the "2015 year" column, stored as 2014 (2014/15).'},
    ]


def build(check=False):
    rows = sorted(extract(), key=lambda r: (r['indicator_id'], r['geography_id'], r['year']))
    result = validate(rows)
    sources = manifest()
    by_series, by_source, by_measure, by_indicator = defaultdict(list), defaultdict(int), defaultdict(int), set()
    for row in rows:
        by_series[(row['indicator_id'], row['geography_id'])].append(row['year'])
        by_source[row['source_id']] += 1
        by_measure[row['indicator_id'].split('.')[1]] += 1
        by_indicator.add(row['indicator_id'])
    coverage_rows = [{'indicator_id': i, 'geography_id': g, 'first_year': min(y), 'last_year': max(y), 'observations': len(y),
                      'unavailable_years': ';'.join(str(year) for year in range(min(y), max(y) + 1) if year not in y)}
                     for (i, g), y in sorted(by_series.items())]
    values = {(r['indicator_id'], r['year']): Decimal(r['value']) for r in rows if r['geography_id'] == GEORGIA}
    shortfall = {}  # 2019-2022, while both lists were in use: the total minus the current fields, as printed.
    for measure in VET_MEASURES.values():
        shortfall[measure] = {}
        for year in range(VET_CURRENT_FROM, VET_CURRENT_ONLY_FROM):
            current = sum(values.get((f'education.{measure}.{f}', year), Decimal(0)) for f in VET_SPANS if f.startswith('field_'))
            shortfall[measure][str(year)] = str(values[(f'education.{measure}.total', year)] - current)
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_DATE,
        'scope': 'Annual research only: schools, pupils and teachers for Georgia (national tables 01 and 06) and by region, '
                 'municipality and kept unit (table 11); public kindergartens, children and staff by place; university students, '
                 'admissions and graduates by level, ownership, sex and field; vocational admissions and graduates by sex and field. '
                 'No grades, ages, dropouts, enrolment rates, exam results, doctoral students, professors or institutions by region.',
        'primary_observation_count': len(rows), 'observations_by_measure': dict(sorted(by_measure.items())),
        'observations_by_source': dict(sorted(by_source.items())), 'indicator_count': len(by_indicator),
        'series_count': len(by_series), 'unavailable_cells': sum(len(years) for years in UNAVAILABLE.values()),
        'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'checks': {
            'coverage_matches_year_ranges': True, 'values_match_source_cells': True,
            'published_values_are_rounded_stored_values_at_cell_precision': True,
            'unavailable_cells_listed_in_prepare_py_produce_no_row': True,
            'vocational_zeros_outside_a_field_span_produce_no_row': {field: f'{a}-{b}' for field, (a, b) in VET_SPANS.items()},
            'parts_add_up_to_total': {'tolerance': {'pupils_national public+private': '0.15', 'all other checks': '0'},
                                      'checks': ['schools, pupils_national and teachers: public + private = total (Georgia)',
                                                 'teachers: women + men = total for Georgia and every unit, 2016/17-2025/26',
                                                 'he_*: public + private, women + men, the three levels and the eight fields = total',
                                                 'vet_*: women + men = total; old + current fields = total every year; current '
                                                 'fields alone = total from 2023',
                                                 'schools, pupils, teachers (total, women, men), kindergartens, kg_children, '
                                                 'kg_staff: municipalities and kept units = region row; regions + Abkhazia AR = '
                                                 'Georgia row']},
            'recorded_mismatches_parts_minus_total': [{'check': c, 'year': y, 'difference': d} for c, y, d in result['mismatches']],
            'vocational_current_fields_shortfall_total_minus_current': shortfall,
            'table_11_georgia_cross_checks_years': result['cross_check_years'],
            'graduates_stored_under_school_year_they_end': '"2011 year" ... "2025 year" -> 2010 ... 2024',
            'anchor_values': {f'{i}:{g}:{y}': p for (i, g, y), p in ANCHORS.items()},
            'table_11_georgia_pupils_2025': str(MUNICIPAL_GEORGIA_PUPILS_2025)},
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'education-annual.csv': csv_bytes(rows, FIELDS),
        'education-series-breaks.csv': csv_bytes(breaks(sorted(by_indicator)), BREAK_FIELDS),
        'coverage.csv': csv_bytes(coverage_rows, list(coverage_rows[0])),
        'validation-report.json': (json.dumps(report, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
    }
    for name, content in outputs.items():
        target = ROOT / name
        if check:
            if not target.exists() or target.read_bytes() != content:
                raise ValueError(f'Generated file is stale: {name}')
        else:
            target.write_bytes(content)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    report = build(check=parser.parse_args().check)
    print(json.dumps({'status': report['status'], 'primary_observation_count': report['primary_observation_count']}))


if __name__ == '__main__':
    main()
