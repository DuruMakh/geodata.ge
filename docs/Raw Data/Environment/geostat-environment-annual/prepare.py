"""Reproduce and check the annual environment and climate research package from its preserved sources.

Uses Python's standard library, plus xlrd 2.0.1 for the old .xls workbooks (research package only:
python3 -m pip install xlrd==2.0.1). Never downloads sources or serves product data.
Rows are found by their printed English label (a repeated label, by the block title, station or pollutant heading that
precedes it) and columns by their year heading, never by fixed positions. Geostat's spelling mistakes are matched as printed.
Downloaded workbooks are untrusted data: run the scripts with `python3 -I` from the package folder.

    python3 -I prepare.py           # rebuild every generated file
    python3 -I prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
import csv
from decimal import ROUND_HALF_UP, Decimal
import functools
import hashlib
import html
import io
import json
from pathlib import Path
import re
import sys
from urllib.parse import quote
from xml.etree import ElementTree as ET
from zipfile import ZipFile


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
RETRIEVED_AT = '2026-10-20'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
XLS = 'application/vnd.ms-excel'
HTML = 'text/html; charset=UTF-8'
SITE = 'https://www.geostat.ge'
NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
PLACEHOLDERS = ('…', '...', '-')  # Geostat's marks for "not available" (and, in Illegal-logging.xls only, "magnitude nil")
STARRED = re.compile(r'(\d+(?:\.\d+)?)\*')  # a number with a footnote mark, such as "47*"
SIGNIFICANT = 12  # published values are rounded to 12 significant digits, which drops floating noise such as -6.699999999999999

PAGES = {  # category id: (English title, Georgian page path)
    565: 'Environmental indicators',
    73: 'Environment statistics',
    822: 'Forest resources',
}

# (media id, published file name, local file, source id, title, category page). Georgian versions follow their English file.
FILES = [
    (72854, 'B-3.-Greenhouse-gas-emissions-ENG.XLSX', 'B-3.-Greenhouse-gas-emissions-ENG.XLSX', 'geostat_env_ghg', 'Table B-3: Greenhouse gas emissions', 565),
    (72853, 'B-3.-Greenhouse-gas-emissions-GEO.xlsx', 'B-3.-Greenhouse-gas-emissions-GEO.xlsx', 'geostat_env_ghg_ka', 'Table B-3: Greenhouse gas emissions (Georgian version)', 565),
    (81576, 'A-1.-Emissions-of-pollutants-into-the-atmospheric-air_ENG.XLSX', 'A-1.-Emissions-of-pollutants-into-the-atmospheric-air_ENG.XLSX',
     'geostat_env_air_emissions', 'Table A-1: Emissions of pollutants into the atmospheric air', 565),
    (81575, 'A-1.-Emissions-of-pollutants-into-the-atmospheric-air_GEO.XLSX', 'A-1.-Emissions-of-pollutants-into-the-atmospheric-air_GEO.XLSX',
     'geostat_env_air_emissions_ka', 'Table A-1: Emissions of pollutants into the atmospheric air (Georgian version)', 565),
    (81814, 'A-2_Ambient_air_quality_in_urban_areas_ENG.XLSX', 'A-2_Ambient_air_quality_in_urban_areas_ENG.XLSX', 'geostat_env_air_quality',
     'Table A-2: Ambient air quality in urban areas', 565),
    (81813, 'A-2-ატმოსფერული-ჰაერის-ხარისხი-ურბანულ-ტერიტორიებზე.xlsx', 'A-2-air-quality-GEO.xlsx', 'geostat_env_air_quality_ka',
     'Table A-2: Ambient air quality in urban areas (Georgian version)', 565),
    (74967, 'B-1_Air-Temperature_ENG.XLSX', 'B-1_Air-Temperature_ENG.XLSX', 'geostat_env_temperature', 'Table B-1: Air temperature', 565),
    (74966, 'B-1-Air_Temperature_GEO.XLSX', 'B-1-Air_Temperature_GEO.XLSX', 'geostat_env_temperature_ka', 'Table B-1: Air temperature (Georgian version)', 565),
    (74969, 'B-2_Atmospheric_precipitation_ENG.XLSX', 'B-2_Atmospheric_precipitation_ENG.XLSX', 'geostat_env_precipitation',
     'Table B-2: Atmospheric precipitation', 565),
    (74968, 'B-2-Atmospheric_precipitation_GEO.XLSX', 'B-2-Atmospheric_precipitation_GEO.XLSX', 'geostat_env_precipitation_ka',
     'Table B-2: Atmospheric precipitation (Georgian version)', 565),
    (80741, 'C-4.-Household-water-use-per-capita_ENG.xlsx', 'C-4.-Household-water-use-per-capita_ENG.xlsx', 'geostat_env_water_household',
     'Table C-4: Household water use per capita', 565),
    (80740, 'C-4.-Household-water-use-per-capita_GEO.xlsx', 'C-4.-Household-water-use-per-capita_GEO.xlsx', 'geostat_env_water_household_ka',
     'Table C-4: Household water use per capita (Georgian version)', 565),
    (80743, 'C-5.-Water-supply-industry-and-population-connected-to-water-supply-industry_ENG.xlsx',
     'C-5.-Water-supply-industry-and-population-connected-to-water-supply-industry_ENG.xlsx', 'geostat_env_water_supply',
     'Table C-5: Water supply industry and population connected to water supply industry', 565),
    (80742, 'C-5.-Water-supply-industry-and-population-connected-to-water-supply-industry_GEO.xlsx',
     'C-5.-Water-supply-industry-and-population-connected-to-water-supply-industry_GEO.xlsx', 'geostat_env_water_supply_ka',
     'Table C-5: Water supply industry and population connected to water supply industry (Georgian version)', 565),
    (80745, 'C-7.-Water-losses_ENG.xlsx', 'C-7.-Water-losses_ENG.xlsx', 'geostat_env_water_losses', 'Table C-7: Water losses', 565),
    (80744, 'C-7.-Water-losses_GEO.xlsx', 'C-7.-Water-losses_GEO.xlsx', 'geostat_env_water_losses_ka', 'Table C-7: Water losses (Georgian version)', 565),
    (83030, 'C-14.-Population-connected-to-wastewater-treatment_ENG.XLSX', 'C-14.-Population-connected-to-wastewater-treatment_ENG.XLSX',
     'geostat_env_wastewater', 'Table C-14: Population connected to wastewater treatment', 565),
    (83029, 'C-14.-Population-connected-to-wastewater-treatment_GEO.XLSX', 'C-14.-Population-connected-to-wastewater-treatment_GEO.XLSX',
     'geostat_env_wastewater_ka', 'Table C-14: Population connected to wastewater treatment (Georgian version)', 565),
    (79501, 'Municipal_Waste_ENG.xlsx', 'Municipal_Waste_ENG.xlsx', 'geostat_env_waste', 'Amount of municipal waste disposed in landfills from the regions', 73),
    (79500, 'Municipal_Waste_GEO.xlsx', 'Municipal_Waste_GEO.xlsx', 'geostat_env_waste_ka',
     'Amount of municipal waste disposed in landfills from the regions (Georgian version)', 73),
    (77539, 'Volume-of-felled-timber.xls', 'Volume-of-felled-timber.xls', 'geostat_env_timber', 'Volume of felled timber', 822),
    (77538, 'ხე-ტყის_მოცულობა.xls', 'felled-timber-GEO.xls', 'geostat_env_timber_ka', 'Volume of felled timber (Georgian version)', 822),
    (77535, 'Illegal-logging.xls', 'Illegal-logging.xls', 'geostat_env_illegal_logging', 'Illegal logging', 822),
    (77534, 'ტყის_უკანონო_ჭრა.xls', 'illegal-logging-GEO.xls', 'geostat_env_illegal_logging_ka', 'Illegal logging (Georgian version)', 822),
    (77533, 'Forest-and-field-fires.xls', 'Forest-and-field-fires.xls', 'geostat_env_fires', 'Forest and field fires', 822),
    (77532, 'ტყის_და_ველის_ხანძრები.xls', 'forest-fires-GEO.xls', 'geostat_env_fires_ka', 'Forest and field fires (Georgian version)', 822),
    # Archived only: no cell of these is served.
    (81578, 'A-3.-Consumption-of-ozone-depleting-substances-(ODS)_ENG.XLSX', 'A-3.-Consumption-of-ozone-depleting-substances-(ODS)_ENG.XLSX',
     'geostat_env_ods', 'Table A-3: Consumption of ozone-depleting substances', 565),
    (79546, 'D-1-Protected-areas.xlsx', 'D-1-Protected-areas.xlsx', 'geostat_env_protected_areas_indicator', 'Table D-1: Protected areas', 565),
    (81580, 'F-2.-Fertilizer-consumption_ENG.XLSX', 'F-2.-Fertilizer-consumption_ENG.XLSX', 'geostat_env_fertilizer', 'Table F-2: Fertilizer consumption', 565),
    (81582, 'F-4.-Pesticide-consumption_ENG.XLSX', 'F-4.-Pesticide-consumption_ENG.XLSX', 'geostat_env_pesticide', 'Table F-4: Pesticide consumption', 565),
    (79549, 'G-1.-Final-energy-consumption_ENG.xlsx', 'G-1.-Final-energy-consumption_ENG.xlsx', 'geostat_env_final_energy', 'Table G-1: Final energy consumption', 565),
    (79550, 'G-2.-Total-primary-energy-supply_ENG.xlsx', 'G-2.-Total-primary-energy-supply_ENG.xlsx', 'geostat_env_primary_energy',
     'Table G-2: Total primary energy supply', 565),
    (79553, 'G-4.-Renewable-energy-supply_ENG.xlsx', 'G-4.-Renewable-energy-supply_ENG.xlsx', 'geostat_env_renewable_energy', 'Table G-4: Renewable energy supply', 565),
    (75359, 'Air-Pollution.xls', 'Air-Pollution.xls', 'geostat_env_stationary_air_pollution', 'Air pollution from stationary sources', 73),
    (75361, 'Protected-Areas.xls', 'Protected-Areas.xls', 'geostat_env_protected_areas', 'Protected areas', 73),
    (75363, 'Violations-of-Law.xls', 'Violations-of-Law.xls', 'geostat_env_violations', 'Violations of environmental law', 73),
    (77559, 'Number-of-visitors-by-protected-areas.xlsx', 'Number-of-visitors-by-protected-areas.xlsx', 'geostat_env_protected_area_visitors',
     'Number of visitors by protected areas', 73),
    (83239, 'Water-quality_ENG.XLSX', 'Water-quality_ENG.XLSX', 'geostat_env_water_quality', 'Water quality', 73),
    (77537, 'Forest_Area.xls', 'Forest_Area.xls', 'geostat_env_forest_area', 'Forest area', 822),
    (59433, 'Volume-of-felled-timber-by-cutting-purpose.xls', 'Volume-of-felled-timber-by-cutting-purpose.xls', 'geostat_env_timber_purpose',
     'Volume of felled timber by cutting purpose', 822),
]


def _content_type(name):
    return XLSX if name.lower().endswith('.xlsx') else XLS


def _sources():
    """(source_id, title, source page, retrieved URL, resolved URL, local file, content type): every workbook, then the six page captures."""
    out = []
    for media, name, local, source_id, title, page in FILES:
        language = 'ka' if source_id.endswith('_ka') else 'en'
        path = f'/media/{media}/{quote(name, safe="")}'
        out.append((source_id, title, f'{SITE}/{language}/modules/categories/{page}', f'https://geostat.ge{path}', f'{SITE}{path}',
                    f'official/{local}', _content_type(name)))
    for page, title in PAGES.items():
        for language, suffix in (('en', ''), ('ka', ' (Georgian version)')):
            url = f'{SITE}/{language}/modules/categories/{page}'
            out.append((f'geostat_env_page_{page}' + ('_ka' if language == 'ka' else ''), f'{title}{suffix} (source page capture)', url, url, url,
                        f'official/page-{page}-{language}.html', HTML))
    return out


SOURCES = _sources()
LOCAL_FILE = {source[0]: source[5] for source in SOURCES}
SERVED_SOURCES = [source_id for _, _, _, source_id, _, _ in FILES[:26] if not source_id.endswith('_ka')]
GEORGIAN_TWIN = {source_id: f'{source_id}_ka' for source_id in SERVED_SOURCES}

FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'decimals', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']
GHG, AIR, AQ, TEMP, RAIN = 'geostat_env_ghg', 'geostat_env_air_emissions', 'geostat_env_air_quality', 'geostat_env_temperature', 'geostat_env_precipitation'
HOUSEHOLD, SUPPLY, LOSSES, WASTEWATER, WASTE = (
    'geostat_env_water_household', 'geostat_env_water_supply', 'geostat_env_water_losses', 'geostat_env_wastewater', 'geostat_env_waste')
TIMBER, LOGGING, FIRES = 'geostat_env_timber', 'geostat_env_illegal_logging', 'geostat_env_fires'
NIL_SOURCES = {LOGGING}  # the one served table whose legend says '"-" Magnitude nil'

REGIONS = [  # (region id, label printed in the waste and forest tables)
    ('region_tbilisi', 'Tbilisi'), ('region_adjara', 'Adjara AR'), ('region_guria', 'Guria'), ('region_imereti', 'Imereti'),
    ('region_kakheti', 'Kakheti'), ('region_mtskheta_mtianeti', 'Mtskheta-Mtianeti'),
    ('region_racha_lechkhumi_kvemo_svaneti', 'Racha-Lechkhumi and Kvemo Svaneti'), ('region_samegrelo_zemo_svaneti', 'Samegrelo-Zemo Svaneti'),
    ('region_samtskhe_javakheti', 'Samtskhe-Javakheti'), ('region_kvemo_kartli', 'Kvemo Kartli'), ('region_shida_kartli', 'Shida Kartli'),
]
# (station code, city, sheet, the name Geostat prints after "Monitoring Station <code> / ")
STATIONS = [
    ('A1', 'tbilisi', 'Tbilisi', 'Varketili'), ('A2', 'tbilisi', 'Tbilisi', 'Kazbegi Avenue'), ('A3', 'tbilisi', 'Tbilisi', 'Tsereteli Avenue'),
    ('A4', 'tbilisi', 'Tbilisi', 'Agmashenebeli Avenue'), ('A5', 'tbilisi', 'Tbilisi', 'Marshal Gelovani ave N34'),
    ('B1', 'kutaisi', 'Kutaisi', 'Asatiani street'), ('B2', 'kutaisi', 'Kutaisi', 'Park of Glory'),
    ('C1', 'batumi', 'Batumi', 'Abuseridze street'), ('C2', 'batumi', 'Batumi', 'Batumi Central Park, 6 May Park'),
    ('D1', 'rustavi', 'Rustavi', 'Batumi str N19'), ('D2', 'rustavi', 'Rustavi', 'Megobroba Ave., N35a'),
    ('E1', 'zestaponi', 'Zestaponi', 'Chikashua str'),
    ('F1', 'zugdidi', 'Other Cities', 'Rustaveli str. N192 (3rd Publc School)'), ('G1', 'akhaltsikhe', 'Other Cities', 'Aspindza str. N18'),
    ('H1', 'telavi', 'Other Cities', 'Kvirike Didi str. N43 (5th public school)'), ('I1', 'mestia', 'Other Cities', 'The Town of Mestia'),
]
CITIES = ['tbilisi', 'kutaisi', 'batumi', 'rustavi', 'zestaponi', 'zugdidi', 'akhaltsikhe', 'telavi', 'mestia']
# The pollutant headings of an automatic station block, and of the Zestaponi manual station (whose MnO2 heading is printed in Georgian)
AUTOMATIC = {'pm10': 'PM 10', 'pm25': 'PM 2.5', 'no2': 'NO2 - nitrogen dioxide'}
ZESTAPONI = {'tsp': 'TSP', 'so2': 'SO2 - Sulphur Dioxide', 'no2': 'NO2 - Nitrogen Dioxide', 'mno2': 'MnO2 - მანგანუმის დიოქსიდი***'}
AVERAGE, LIMIT, DAYS = 'Annual average concentration', 'Annual average limit value', 'Number of days with exceeded daily limit value'


def station_id(code):
    city = next(city for found, city, _, _ in STATIONS if found == code)
    return f'{city}_{code.lower()}'


class Spec:
    """Where one indicator lives: workbook (and sheet), unit, the unit Geostat prints in column B (None where the table has no
    unit column), its row label, and the labels to pass first (block title, station or pollutant heading). A label that repeats
    takes `first=True`: its first occurrence below the last `after` label, which must lie inside that label's section."""

    def __init__(self, source_id, unit, printed_unit, label, after=(), first=False, sheet=None):
        self.source_id, self.unit, self.printed_unit, self.label, self.after, self.first, self.sheet = (
            source_id, unit, printed_unit, label, tuple(after), first, sheet)


def _specs():
    out = {}
    ghg = (('total', 'Aggregated emissions (CO2 equivalents)'),
           ('net', 'Aggregated emissions including emissions/removals from LULUCF (CO2 equivalents)'),
           ('sector_energy', 'Energy-total'), ('sector_industry', 'Industrial Processes'), ('sector_agriculture', 'Agriculture'),
           ('sector_waste', 'Waste'), ('sector_land', 'Land use and forestry'),
           ('energy_stationary', 'combustion in stationary sources'), ('energy_transport', 'combustion in mobile sources'),
           ('energy_fugitive', 'fugitive emissions'),
           ('gas_co2', 'Carbon dioxide (CO2)'), ('gas_methane', 'Methane (CH4)'), ('gas_nitrous_oxide', 'Nitrous oxide (S2O)'))
    for name, label in ghg:
        out[f'environment.ghg.{name}'] = Spec(GHG, 'mt_co2e', 'Mt/year', label)
    out['environment.ghg.gas_hfcs'] = Spec(GHG, 'kt_co2e', 'kt/year', 'HFCs')
    out['environment.ghg.gas_sf6'] = Spec(GHG, 'kt_co2e', 'kt/year', 'SF6')
    out['environment.ghg.per_person'] = Spec(GHG, 't_co2e_per_person', 't/capita', 'Aggregated GHG emissions per capita')

    for name, label in (('co', 'Carbon monoxide (CO), total'), ('nox', 'Nitrogen oxides (NOX), total'), ('so2', 'Sulphur dioxide (SO2), total'),
                        ('nh3', 'Ammonia (NH3), total'), ('nmvoc', 'Non-methane volatile organic compounds (NMVOC), total'),
                        ('tsp', 'Total suspended particulates (TSP), total'), ('pm10', 'Patriculate matters (PM10), total'),
                        ('pm25', 'Patriculate matters (PM2.5), total')):
        out[f'environment.air.{name}.total'] = Spec(AIR, 'thousand_tonnes', '1000 t/year', label)
        # The tonnes row comes first; the percentage row below it repeats the label
        out[f'environment.air.{name}.stationary'] = Spec(AIR, 'thousand_tonnes', '1000 t/year', 'from stationary sources', after=(label,), first=True)
        out[f'environment.air.{name}.mobile'] = Spec(AIR, 'thousand_tonnes', '1000 t/year', 'from mobile sources', after=(label,), first=True)

    for city in CITIES:  # a city's stations under each pollutant in turn, as the city page lists them
        stations = [(code, sheet, f'Monitoring Station {code} / {name}') for code, found, sheet, name in STATIONS if found == city]
        headings = ZESTAPONI if city == 'zestaponi' else AUTOMATIC
        for measure, heading in headings.items():
            for code, sheet, block in stations:
                out[f'environment.aq.{measure}_avg.{station_id(code)}'] = Spec(AQ, 'ug_m3', 'µg/m3', AVERAGE, after=(block, heading), first=True, sheet=sheet)
        if city != 'zestaponi':
            for code, sheet, block in stations:
                out[f'environment.aq.pm10_days.{station_id(code)}'] = Spec(AQ, 'days', 'day', DAYS, after=(block, AUTOMATIC['pm10']), first=True, sheet=sheet)

    for kind, source, unit, printed, row in (('temperature', TEMP, 'celsius', 'OC', 'Annual average temperature'),
                                             ('temperature_anomaly', TEMP, 'celsius', 'OC', 'Average annual deviation from the average temperature'),
                                             ('precipitation', RAIN, 'mm', 'mm', 'Annual precipitation')):
        blocks = CLIMATE_BLOCKS[source]
        for area, title in blocks:
            out[f'environment.climate.{kind}.{area}'] = Spec(source, unit, printed, row, after=(title,), first=True)

    out['environment.water.gross'] = Spec(SUPPLY, 'million_m3', 'million m3', 'Gross volume of water supplied by water supply industry')
    out['environment.water.lost'] = Spec(SUPPLY, 'million_m3', 'million m3', 'Losses during transport')
    out['environment.water.net'] = Spec(SUPPLY, 'million_m3', 'million m3', 'Net volume of water supplied by water supply industry')
    out['environment.water.households'] = Spec(HOUSEHOLD, 'million_m3', 'million m3', 'Water supplied to households by water supply industry*')
    out['environment.water.lost_share'] = Spec(LOSSES, 'percent', '%', 'Percentage of water losses during transport',
                                               after=('Percentage of water losses during transport',))
    out['environment.water.people_piped'] = Spec(SUPPLY, 'million_persons', 'million', 'Number of population connected to water supply industry')
    sewers, treatment = 'Population connected to a wastewater collecting system', 'Population connected to wastewater treatment facilities'
    out['environment.water.people_sewers'] = Spec(WASTEWATER, 'million_persons', 'million', 'Population connected', after=(sewers,), first=True)
    out['environment.water.people_treatment'] = Spec(WASTEWATER, 'million_persons', 'million', 'Population connected', after=(treatment,), first=True)
    out['environment.water.share_piped'] = Spec(SUPPLY, 'percent', '%', 'Percentage of population connected to water supply industry')
    out['environment.water.share_sewers'] = Spec(WASTEWATER, 'percent', '%', 'Percentage of total population connected', after=(sewers,), first=True)
    out['environment.water.share_treatment'] = Spec(WASTEWATER, 'percent', '%', 'Percentage of total population connected', after=(treatment,), first=True)
    out['environment.water.per_person'] = Spec(HOUSEHOLD, 'm3_per_person', 'm3',
                                               'Total household water use (water supply industry and self supply) per capita*')
    for name, label in (('primary', 'Primary/mechanical treatment'), ('secondary', 'Secondary/biological treatment'), ('tertiary', 'Tertiary/advanced treatment')):
        out[f'environment.water.treatment_{name}'] = Spec(WASTEWATER, 'million_persons', 'million', label)

    out['environment.waste.collected.georgia'] = Spec(WASTE, 'thousand_tonnes', '1000 tons', 'Georgia')
    for region, label in REGIONS:
        out[f'environment.waste.collected.{region}'] = Spec(WASTE, 'thousand_tonnes', None, label)
    out['environment.waste.per_person'] = Spec(WASTE, 'kg_per_person', 'kg', 'Municipal waste generation per capita')

    for measure, source in (('timber_cut', TIMBER), ('illegal_logging', LOGGING)):
        out[f'environment.forest.{measure}.georgia'] = Spec(source, 'm3', None, 'Georgia')
        for region, label in REGIONS:
            out[f'environment.forest.{measure}.{region}'] = Spec(source, 'm3', None, label)
        out[f'environment.forest.{measure}.protected_areas'] = Spec(source, 'm3', None, 'Protected areas')
    out['environment.forest.fires'] = Spec(FIRES, 'fires', None, 'Number of fire cases (unit)')
    out['environment.forest.burnt_area'] = Spec(FIRES, 'hectares', None, 'Area covered by fire (hectare)')
    return out


# (area id, block title) of the climate tables; Geostat names the warmest, coldest, wettest and driest regions in the titles
CLIMATE_BLOCKS = {
    TEMP: [('georgia', 'Georgia'), ('tbilisi', 'Tbilisi'),
           ('warmest', 'The region with the maximum average temperature 1961-1990 (except for Tbilisi): Guria'),
           ('coldest', 'The region with the minimum average temperature 1961-1990: Racha-Lechkhumi and Kvemo Svaneti')],
    RAIN: [('georgia', 'Georgia'), ('tbilisi', 'Tbilisi'),
           ('wettest', 'Region with the maximum average precipitation 1961-1990: Samegrelo-Zemo Svaneti'),
           ('driest', 'Region with the minimum average precipitation 1961-1990: Kvemo Kartli')],
}
SPECS = _specs()
# Rows read only to check the served values: C-7 repeats the C-5 volumes
CHECKS = {
    'losses_gross': Spec(LOSSES, 'million_m3', 'million m3', 'Gross volume of water supplied by water supply industry'),
    'losses_net': Spec(LOSSES, 'million_m3', 'million m3', 'Net volume of water supplied by water supply industry'),
    'losses_lost': Spec(LOSSES, 'million_m3', 'million m3', 'Losses of water during transport'),
}
for _code, _city, _sheet, _name in STATIONS:  # every station block's printed yearly limits (none at the Zestaponi manual station)
    if _city != 'zestaponi':
        for _measure, _heading in AUTOMATIC.items():
            CHECKS[f'limit.{_measure}.{station_id(_code)}'] = Spec(AQ, 'ug_m3', 'µg/m3', LIMIT, after=(f'Monitoring Station {_code} / {_name}', _heading),
                                                                  first=True, sheet=_sheet)
LIMIT_MEASURES = list(AUTOMATIC)


# ---------------------------------------------------------------- reading

def clean(value):
    """Whitespace (including non-breaking spaces and line breaks) collapsed, zero-width characters dropped."""
    return ' '.join(value.replace('​', '').split()) if isinstance(value, str) else value


def _column_number(column):
    number = 0
    for letter in column:
        number = number * 26 + ord(letter) - 64
    return number


def _column_letters(index):
    """The column letters of a 0-based column index."""
    letters = ''
    index += 1
    while index:
        index, remainder = divmod(index - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


CELL = re.compile(r'<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)')
ATTRIBUTE = re.compile(r'([\w:]+)="([^"]*)"')


def _text(xml):
    return html.unescape(''.join(re.findall(r'<t\b[^>]*>([\s\S]*?)</t>', re.sub(r'<rPh\b[\s\S]*?</rPh>', '', xml))))


BUILT_IN_FORMATS = {0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00'}


def _xlsx_formats(archive):
    """The number format of each cell style (the `s` attribute of a cell): a built-in or the workbook's own format code."""
    styles = ET.fromstring(archive.read('xl/styles.xml'))
    codes = {int(item.get('numFmtId')): item.get('formatCode') for item in styles.findall('x:numFmts/x:numFmt', NS)}
    return [codes.get(int(xf.get('numFmtId', 0)), BUILT_IN_FORMATS.get(int(xf.get('numFmtId', 0)))) for xf in styles.findall('x:cellXfs/x:xf', NS)]


def _read_xlsx(path):
    """{sheet name: {row: {column: {value, cell, kind, format}}}} of every worksheet of a .xlsx. Numbers stay exact decimal tokens
    ('n', Decimal) with their number format; text is 'content' ('s'). A self-closing or valueless cell is absent."""
    out = {}
    with ZipFile(path) as archive:
        formats = _xlsx_formats(archive)
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        relations = {rel.get('Id'): rel.get('Target') for rel in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.findall('x:t', NS) + item.findall('x:r/x:t', NS))  # phonetic runs (rPh) are not text
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('x:si', NS)]
        for sheet in workbook.findall('x:sheets/x:sheet', NS):
            target = relations[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            part = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            xml = archive.read(part).decode('utf-8')
            rows = defaultdict(dict)
            for attributes, body in CELL.findall(xml):
                attributes = dict(ATTRIBUTE.findall(attributes))
                coordinate, kind = attributes['r'], attributes.get('t', 'n')
                column, row = re.fullmatch(r'([A-Z]+)(\d+)', coordinate).groups()
                token = re.search(r'<v>([\s\S]*?)</v>', body or '')
                if kind == 'inlineStr':
                    value = _text(body)
                elif token is None or token.group(1) == '':
                    continue
                elif kind == 's':
                    value = strings[int(token.group(1))]
                elif kind == 'str':
                    value = html.unescape(token.group(1))
                elif kind == 'n':
                    value = Decimal(token.group(1))
                else:
                    raise ValueError(f'Unsupported cell type {kind}: {coordinate}')
                rows[int(row)][column] = {'value': value, 'cell': coordinate, 'kind': 'n' if kind == 'n' else 's', 'format': formats[int(attributes.get('s', 0))]}
            out[sheet.get('name')] = {number: dict(sorted(cells.items(), key=lambda item: _column_number(item[0]))) for number, cells in sorted(rows.items())}
    return out


def _read_xls(path):
    """{sheet name: rows} of an .xls, read with xlrd 2.0.1. A cell's address is computed from its 0-based row and column."""
    try:
        import xlrd
    except ImportError as error:
        raise SystemExit('xlrd 2.0.1 is needed to read the .xls workbooks: python3 -m pip install xlrd==2.0.1') from error
    book = xlrd.open_workbook(str(path), formatting_info=True)
    out = {}
    for sheet in book.sheets():
        rows = defaultdict(dict)
        for row in range(sheet.nrows):
            for column in range(sheet.ncols):
                cell_type = sheet.cell_type(row, column)
                if cell_type in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
                    continue
                if cell_type == xlrd.XL_CELL_NUMBER:
                    value, kind = Decimal(repr(sheet.cell_value(row, column))), 'n'
                elif cell_type == xlrd.XL_CELL_TEXT:
                    value, kind = sheet.cell_value(row, column), 's'
                else:
                    raise ValueError(f'Unsupported cell type {cell_type}: {_column_letters(column)}{row + 1} in {Path(path).name}')
                number_format = book.format_map[book.xf_list[sheet.cell_xf_index(row, column)].format_key].format_str
                rows[row + 1][_column_letters(column)] = {'value': value, 'cell': f'{_column_letters(column)}{row + 1}', 'kind': kind, 'format': number_format}
        out[sheet.name] = dict(sorted(rows.items()))
    return out


@functools.lru_cache(maxsize=None)
def workbook(source_id):
    path = ROOT / LOCAL_FILE[source_id]
    return _read_xlsx(path) if str(path).lower().endswith('.xlsx') else _read_xls(path)


def sheet_name(spec):
    """The sheet an indicator is read from: the named one, or the workbook's only sheet."""
    sheets = workbook(spec.source_id)
    if spec.sheet is not None:
        if spec.sheet not in sheets:
            raise ValueError(f'No sheet {spec.sheet} in {spec.source_id}')
        return spec.sheet
    if len(sheets) != 1:
        raise ValueError(f'Expected one worksheet in {spec.source_id}, found {len(sheets)}')
    return next(iter(sheets))


def rows_of(spec):
    return workbook(spec.source_id)[sheet_name(spec)]


def reread(source_id, name, address):
    """The cell at `address`, re-read from the preserved original."""
    sheets = workbook(source_id)
    if name not in sheets:
        raise ValueError(f'Unexpected sheet {name} in {source_id}')
    column, row = re.fullmatch(r'([A-Z]+)(\d+)', address).groups()
    cell = sheets[name].get(int(row), {}).get(column)
    if cell is None:
        raise ValueError(f'No cell {address} in {source_id}')
    return cell


def _label(cells):
    cell = cells.get('A')
    return clean(cell['value']) if cell and cell['kind'] == 's' else None


def _is_section(cells):
    """A block title or pollutant heading: a label in column A and nothing else on the row ("Of which:" lines are not)."""
    return _label(cells) is not None and len(cells) == 1 and not _label(cells).endswith(':')


def find_row(rows, label, after=(), first=False):
    """The row number of a label (column A, whitespace collapsed, otherwise exactly as printed). The search starts below the
    first occurrence of each label in `after`, in turn. Without `first` the label must then occur exactly once; with `first`
    it is the first occurrence, which must come before the next block title or heading."""
    start = 0
    for step in after:
        found = [number for number, cells in rows.items() if number > start and _label(cells) == step]
        if not found:
            raise ValueError(f'Expected row "{step}" not found below row {start}')
        start = found[0]
    matches = [number for number, cells in rows.items() if number > start and _label(cells) == label]
    if not matches or (len(matches) > 1 and not first):
        raise ValueError(f'Expected row "{label}" not found exactly once' + (f' below "{after[-1]}"' if after else '') + f': {matches}')
    if first and after:
        sections = [number for number, cells in rows.items() if start < number < matches[0] and _is_section(cells)]
        if sections:
            raise ValueError(f'Row "{label}" is missing under "{after[-1]}" (next found below row {sections[0]})')
    return matches[0]


def _is_header(cells):
    """A year heading: the numbers right of column A are whole, increasing years, at least three of them or beside a printed
    "Unit" heading (the four "other cities" stations print two years)."""
    numbers = [cell['value'] for column, cell in cells.items() if column != 'A' and cell['kind'] == 'n']
    unit = cells.get('B', {}).get('kind') == 's' and clean(cells['B']['value']) in ('Unit', 'Units')
    return (len(numbers) >= 3 or (unit and len(numbers) >= 2)) and \
        all(value == value.to_integral_value() and 1900 <= value <= 2100 for value in numbers) and all(a < b for a, b in zip(numbers, numbers[1:]))


def year_columns(rows, header):
    """{column letter: year} of one heading row; a text heading other than "Unit" or "Units" is an error."""
    found = {}
    for column, cell in rows[header].items():
        if column == 'A':
            continue
        if cell['kind'] == 'n':
            found[column] = int(cell['value'])
        elif not (column == 'B' and clean(cell['value']) in ('Unit', 'Units')):
            raise ValueError(f'Unexpected year heading {clean(cell["value"])!r} in {cell["cell"]}')
    return found


def header_for(rows, row):
    """The heading row that governs a data row: the nearest one above it."""
    above = [number for number, cells in rows.items() if number < row and _is_header(cells)]
    if not above:
        raise ValueError(f'No year heading above row {row}')
    return max(above)


def published(cell, source_id):
    """(published value, footnote mark printed) of a served cell, or None for a Geostat placeholder. A number is rounded to
    12 significant digits, which only ever drops floating noise; a number printed as text with a footnote mark ("47*") is the
    number. A "-" is zero only in the table whose legend says it means "magnitude nil"."""
    if cell is None:
        return None
    if cell['kind'] == 'n':
        raw = cell['value']
        rounded = Decimal(format(float(raw), f'.{SIGNIFICANT}g'))
        if abs(rounded - raw) > Decimal('1e-9') * max(Decimal(1), abs(raw)):
            raise ValueError(f'Rounding would change a published value: {cell}')
        return _plain(rounded), False
    text = clean(cell['value'])
    if text == '-' and source_id in NIL_SOURCES:
        return '0', False
    if text in PLACEHOLDERS or text == '':
        return None
    starred = STARRED.fullmatch(text)
    if starred:
        return _plain(Decimal(starred.group(1))), True
    raise ValueError(f'Unexpected cell content: {cell}')


def _plain(number):
    """A decimal as plain text without exponent or trailing zeros: 11.40 is 11.4, 876749.0 is 876749, -0 is 0."""
    text = format(number.normalize(), 'f')
    if '.' in text:
        text = text.rstrip('0').rstrip('.')
    return '0' if text in ('-0', '') else text


def decimals(text):
    return len(text.split('.')[1]) if '.' in text else 0


FIXED_FORMAT = re.compile(r'0(\.0+)?|#,##0|#\\ ##0')


def displayed(cell, value):
    """The figure Geostat's table shows: a number cell rounded half up to the decimals of its number format, or the value itself
    when the format is General (and for a number printed as text). Geostat often stores more decimals than it prints, such as
    17.66 printed as 17.7, or 44.5 µg/m³ printed as 45."""
    if cell['kind'] != 'n' or cell['format'] == 'General':
        return value
    if not FIXED_FORMAT.fullmatch(cell['format']):
        raise ValueError(f'Unexpected number format: {cell}')
    places = decimals(cell['format'])
    return _plain(cell['value'].quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


# ---------------------------------------------------------------- extraction

def _spec(key):
    return SPECS[key] if key in SPECS else CHECKS[key]


@functools.lru_cache(maxsize=None)
def locate(key):
    """The row number holding an indicator (or check) in its sheet; its printed unit must be the expected one."""
    spec = _spec(key)
    rows = rows_of(spec)
    row = find_row(rows, spec.label, spec.after, spec.first)
    printed = rows[row].get('B')
    if spec.printed_unit is not None and (printed is None or clean(printed['value']) != spec.printed_unit):
        raise ValueError(f'Unexpected unit for {key}: {printed}')
    return row


@functools.lru_cache(maxsize=None)
def header_columns(key):
    rows = rows_of(_spec(key))
    return year_columns(rows, header_for(rows, locate(key)))


def cells_of(key):
    """{year: (cell, published value, starred)} of the cells in an indicator's row that carry a value."""
    spec = _spec(key)
    row = rows_of(spec)[locate(key)]
    found = {}
    for column, year in header_columns(key).items():
        value = published(row.get(column), spec.source_id)
        if value is not None:
            found[year] = (row[column], *value)
    return found


def extract():
    """Every served observation, located by label text and re-read from its original cell. A city's yearly limits are its first
    station's printed limit rows, served only in the years one of its stations has a yearly average for that pollutant."""
    rows = []
    for indicator_id, spec in SPECS.items():
        found = cells_of(indicator_id)
        if not found:
            continue  # a station that has never published this measure (the "other cities" print no NO2 days)
        for year, (cell, value, _) in found.items():
            rows.append(_row(year, indicator_id, value, spec, cell))
    for city in CITIES:
        stations = [station_id(code) for code, found, _, _ in STATIONS if found == city]
        if city == 'zestaponi':
            continue
        for measure in LIMIT_MEASURES:
            years = sorted({year for station in stations for year in cells_of(f'environment.aq.{measure}_avg.{station}')})
            if not years:
                continue
            limits = cells_of(f'limit.{measure}.{stations[0]}')
            spec = Spec(AQ, 'ug_m3', 'µg/m3', LIMIT, sheet=_spec(f'limit.{measure}.{stations[0]}').sheet)
            for year in years:
                if year not in limits:
                    raise ValueError(f'No printed {measure} limit for {city} in {year}')
                cell, value, _ = limits[year]
                rows.append(_row(year, f'environment.aq.{measure}_limit.{city}', value, spec, cell))
    return sorted(rows, key=lambda row: (ORDER[row['indicator_id']], row['year']))


def _row(year, indicator_id, value, spec, cell):
    shown = displayed(cell, value)
    return {'year': year, 'indicator_id': indicator_id, 'value': value, 'published_value': shown, 'unit': spec.unit, 'decimals': decimals(shown),
            'basis': 'actual', 'value_status': 'official', 'source_id': spec.source_id, 'source_sheet': sheet_name(spec), 'source_cell': cell['cell']}


def _order():
    """The served indicators in page order: a city's limit row follows its stations' yearly averages of that pollutant."""
    order = []
    for indicator_id in SPECS:
        order.append(indicator_id)
    for city in CITIES:
        for measure in LIMIT_MEASURES:
            stations = [f'environment.aq.{measure}_avg.{station_id(code)}' for code, found, _, _ in STATIONS if found == city]
            if city != 'zestaponi':
                order.insert(order.index(stations[-1]) + 1, f'environment.aq.{measure}_limit.{city}')
    return {indicator: number for number, indicator in enumerate(order)}


ORDER = _order()


# ---------------------------------------------------------------- validation

TOLERANCE = {'rounded': Decimal('0.15'), 'forest': Decimal('2')}


def validate(rows):
    """Every check of design section 11. Returns the published rounding differences of each sum check (exact, never filled)."""
    keys, by_key = set(), {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        if row['indicator_id'] not in ORDER:
            raise ValueError(f'Unexpected indicator: {key}')
        if row['basis'] != 'actual' or row['value_status'] != 'official':
            raise ValueError(f'Unexpected basis or status: {key}')
        if not re.fullmatch(r'-?\d+(\.\d+)?', row['value']) or row['decimals'] != decimals(row['published_value']):
            raise ValueError(f'Value is not a plain decimal: {key} {row["value"]}')
        if not 1990 <= row['year'] <= 2025:
            raise ValueError(f'Year outside the published tables: {key}')
        by_key[key] = Decimal(row['value'])
    expected = {(row['indicator_id'], row['year']): row for row in extract()}
    if keys != set(expected):
        raise ValueError(f'Coverage mismatch: {len(set(expected) - keys)} missing, {len(keys - set(expected))} extra')
    for row in rows:
        wanted = expected[(row['indicator_id'], row['year'])]
        if any(row[field] != wanted[field] for field in ('unit', 'source_id', 'source_sheet')):
            raise ValueError(f"Unexpected unit, source or sheet: {row['indicator_id']} {row['year']}")

    differences = []

    def v(indicator, year, default=None):
        value = by_key.get((indicator, year), default)
        if value is None:
            raise ValueError(f'Missing observation: {indicator} {year}')
        return value

    def agree(check, year, total, parts, tolerance):
        difference = sum(parts) - total
        if abs(difference) > TOLERANCE[tolerance]:
            raise ValueError(f'{check} does not add up in {year}: {difference}')
        if difference:
            differences.append({'check': check, 'year': year, 'difference': _plain(difference)})

    years = lambda indicator: sorted(year for found, year in keys if found == indicator)
    for year in years('environment.ghg.total'):
        total = v('environment.ghg.total', year)
        agree('ghg_sectors', year, total, [v(f'environment.ghg.sector_{s}', year) for s in ('energy', 'industry', 'agriculture', 'waste')], 'rounded')
        agree('ghg_energy', year, v('environment.ghg.sector_energy', year),
              [v(f'environment.ghg.energy_{s}', year) for s in ('stationary', 'transport', 'fugitive')], 'rounded')
        agree('ghg_gases', year, total, [v(f'environment.ghg.gas_{g}', year) for g in ('co2', 'methane', 'nitrous_oxide')] +
              [v(f'environment.ghg.gas_{g}', year, Decimal(0)) / 1000 for g in ('hfcs', 'sf6')], 'rounded')
        agree('ghg_net', year, v('environment.ghg.net', year), [total, v('environment.ghg.sector_land', year)], 'rounded')
    for pollutant in ('co', 'nox', 'so2', 'nh3', 'nmvoc', 'tsp', 'pm10', 'pm25'):
        for year in years(f'environment.air.{pollutant}.total'):
            agree(f'air_{pollutant}', year, v(f'environment.air.{pollutant}.total', year),
                  [v(f'environment.air.{pollutant}.stationary', year), v(f'environment.air.{pollutant}.mobile', year)], 'rounded')
    for year in years('environment.water.gross'):
        gross = v('environment.water.gross', year)
        agree('water_volumes', year, gross, [v('environment.water.lost', year), v('environment.water.net', year)], 'rounded')
        share = (v('environment.water.lost', year) / gross * 100).quantize(Decimal('0.1'))
        if abs(share - v('environment.water.lost_share', year)) > TOLERANCE['rounded']:
            raise ValueError(f'Published water loss share does not match its volumes: {year}')
        for check, indicator in (('losses_gross', 'gross'), ('losses_net', 'net'), ('losses_lost', 'lost')):
            if Decimal(cells_of(check)[year][1]) != v(f'environment.water.{indicator}', year):
                raise ValueError(f'C-7 and C-5 print different water volumes: {indicator} {year}')
    for year in years('environment.waste.collected.georgia'):
        agree('waste_regions', year, v('environment.waste.collected.georgia', year),
              [v(f'environment.waste.collected.{region}', year) for region, _ in REGIONS], 'rounded')
    for measure in ('timber_cut', 'illegal_logging'):
        for year in years(f'environment.forest.{measure}.georgia'):
            parts = [by_key[(f'environment.forest.{measure}.{area}', year)] for area in [region for region, _ in REGIONS] + ['protected_areas']
                     if (f'environment.forest.{measure}.{area}', year) in by_key]
            agree(f'forest_{measure}', year, v(f'environment.forest.{measure}.georgia', year), parts, 'forest')
    for check in CHECKS:  # every station block of a city prints its city's limits
        if not check.startswith('limit.'):
            continue
        _, measure, station = check.split('.')
        city = station.rsplit('_', 1)[0]
        first = next(station_id(code) for code, found, _, _ in STATIONS if found == city)
        for year, (_, value, _) in cells_of(check).items():
            if year in cells_of(f'limit.{measure}.{first}') and cells_of(f'limit.{measure}.{first}')[year][1] != value:
                raise ValueError(f'Station blocks of {city} print different {measure} limits in {year}')
    for indicator, year, expected in ANCHORS:
        if v(indicator, year) != Decimal(expected):
            raise ValueError(f'Anchor value differs: {indicator} {year}')

    for row in rows:  # last, so an altered value is reported by the cross-check that notices it first
        cell = reread(row['source_id'], row['source_sheet'], row['source_cell'])
        value = published(cell, row['source_id'])
        if value is None or value[0] != row['value'] or displayed(cell, value[0]) != row['published_value']:
            raise ValueError(f"Row disagrees with its source cell: {row['indicator_id']} {row['year']} {row['source_cell']}")
    return differences


ANCHORS = [
    ('environment.ghg.total', 2000, '11.4'), ('environment.ghg.total', 2022, '20.1'), ('environment.ghg.per_person', 2022, '5.4'),
    ('environment.ghg.sector_land', 2022, '-5.8'), ('environment.air.co.total', 2024, '86.4'),
    ('environment.aq.pm10_avg.tbilisi_a1', 2025, '31'), ('environment.aq.pm10_avg.rustavi_d1', 2025, '51'),
    ('environment.aq.pm10_days.kutaisi_b1', 2025, '67'), ('environment.aq.pm10_limit.rustavi', 2025, '40'),
    ('environment.aq.pm25_limit.tbilisi', 2019, '25'), ('environment.aq.pm25_limit.tbilisi', 2020, '20'),
    ('environment.climate.temperature.georgia', 2024, '10.3'), ('environment.climate.temperature_anomaly.georgia', 2024, '1.9'),
    ('environment.water.lost', 2025, '559.9'), ('environment.water.lost_share', 2025, '64.4'), ('environment.water.share_piped', 2025, '72.8'),
    ('environment.waste.collected.georgia', 2024, '1184'), ('environment.waste.per_person', 2024, '319.6'),
    ('environment.forest.timber_cut.georgia', 2024, '376215'), ('environment.forest.timber_cut.region_kakheti', 2023, '52954.015'),
    ('environment.forest.illegal_logging.georgia', 2014, '45915'), ('environment.forest.illegal_logging.region_guria', 2011, '0'),
]


# ---------------------------------------------------------------- outputs

def manifest():
    records = []
    for source_id, title, page, url, resolved, local_file, content_type in SOURCES:
        data = (ROOT / local_file).read_bytes()
        records.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': page,
                        'retrieved_file_url': url, 'resolved_file_url': resolved, 'retrieved_at': RETRIEVED_AT,
                        'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                        'content_type': content_type})
    return records


def csv_bytes(rows, fields):
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode('utf-8-sig')


def _ranges(found):
    out, start = [], None
    for index, year in enumerate(found):
        if start is None:
            start = year
        if index + 1 == len(found) or found[index + 1] != year + 1:
            out.append(str(start) if start == year else f'{start}-{year}')
            start = None
    return ';'.join(out)


def build(check=False):
    rows = extract()
    differences = validate(rows)
    sources = manifest()
    by_indicator, counts, families = defaultdict(list), defaultdict(int), defaultdict(int)
    for row in rows:
        by_indicator[row['indicator_id']].append(row['year'])
        counts[row['source_id']] += 1
        families[row['indicator_id'].split('.')[1]] += 1
    starred = [{key: row[key] for key in ('indicator_id', 'year', 'source_sheet', 'source_cell', 'value')} |
               {'printed': clean(reread(row['source_id'], row['source_sheet'], row['source_cell'])['value'])}
               for row in rows if reread(row['source_id'], row['source_sheet'], row['source_cell'])['kind'] == 's' and row['value'] != '0']
    nil = [{key: row[key] for key in ('indicator_id', 'year', 'source_cell')} for row in rows
           if reread(row['source_id'], row['source_sheet'], row['source_cell'])['kind'] == 's' and row['value'] == '0']

    def printed_years(indicator):
        key = indicator if indicator in SPECS else None
        if key is None:  # a city limit: its first station's heading
            _, _, measure, city = indicator.split('.')
            first = next(station_id(code) for code, found, _, _ in STATIONS if found == city)
            key = f'environment.aq.{measure.replace("_limit", "_avg")}.{first}'
        return set(header_columns(key).values())

    coverage_rows = []
    for indicator, found in by_indicator.items():
        gaps = sorted(year for year in printed_years(indicator) if min(found) < year < max(found) and year not in found)
        coverage_rows.append({'indicator_id': indicator, 'first_year': min(found), 'last_year': max(found), 'observations': len(found),
                              'unavailable_years': _ranges(gaps)})
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_AT,
        'scope': 'Annual research only: Geostat environment statistics (greenhouse gases 2000-2022, air pollutant emissions 2013-2024, city air '
                 'quality by monitoring station 2005-2025, temperature and precipitation 1990, 1995 and 2000-2024, water supply 2015-2025, '
                 'municipal waste 2015-2024, timber, illegal logging and fires 2010-2024); no derived values and no serving',
        'primary_observation_count': len(rows), 'observations_by_family': dict(sorted(families.items())),
        'observations_by_source': dict(sorted(counts.items())), 'indicators': len(by_indicator),
        'footnoted_number_cells': starred, 'magnitude_nil_cells': nil,
        'placeholder_cells_in_served_values': 0, 'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'published_rounding_differences': differences,
        'checks': ['no duplicate observation and no year outside the published tables; every value is a plain decimal with its decimals count',
                   'a "…", "..." or "-" cell is never served as a value, except "-" in Illegal-logging.xls, whose legend says "Magnitude nil" (served as 0)',
                   'numbers are the published cells rounded to 12 significant digits, which only drops floating noise; a number printed with a '
                   'footnote mark ("47*") is served as the number',
                   'every row equals a fresh read of its source cell, row label, block heading, printed unit and year heading',
                   'greenhouse gases: energy, industry, agriculture and waste add up to the total; the three energy rows add up to energy; CO2, '
                   'methane, nitrous oxide and HFCs and SF6 (thousand tonnes / 1,000) add up to the total; the total plus land use equals the net '
                   'total (tolerance 0.15, every difference recorded)',
                   'air pollutants: stationary and mobile sources add up to each total (tolerance 0.15)',
                   'water: losses and net volume add up to the gross volume; the published loss share matches the volumes; C-7 prints the C-5 volumes',
                   'waste: the eleven regions add up to Georgia (tolerance 0.15)',
                   'timber cut and illegal logging: the regions and protected areas add up to Georgia (tolerance 2 m3)',
                   'city air quality: every station block of a city prints the same yearly limits; a limit is served only in years with a station value',
                   'anchor values of the design document',
                   'independent-validation.json re-reads every cell with SheetJS and compares the Georgian copies with the English workbooks'],
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'environment-annual.csv': csv_bytes(rows, FIELDS),
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
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true')
    report = build(check=parser.parse_args().check)
    print(json.dumps({'status': report['status'], 'primary_observation_count': report['primary_observation_count']}))


if __name__ == '__main__':
    main()
