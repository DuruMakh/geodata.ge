"""Published annual education and long-term unemployment tables, 2020-2025."""

from decimal import Decimal, ROUND_HALF_UP
import json

from prepare import COUNT_TOLERANCE, RATE_TOLERANCE, FIELDS, clean, csv_bytes, read_sheet


SEX_SHEETS = {'total': 'Total', 'women': 'Women', 'men': 'Men'}
EDUCATION = {
    'Primary or Lower Secondary': 'education.primary_or_lower_secondary',
    'Upper Secondary': 'education.upper_secondary',
    'Vocational': 'education.vocational',
    'Higher': 'education.higher',
    'No education': 'education.no_education',
    'Total': 'education.total',
}
RATE_GROUPS = tuple(list(EDUCATION)[:4])
RATE_METRICS = ('participation_rate', 'employment_rate', 'unemployment_rate')
SHARE_COUNTS = {
    'share_of_labour_force': 'labour_force',
    'share_of_employed': 'employed',
    'share_of_unemployed': 'unemployed',
    'share_of_outside_labour_force': 'outside_labour_force',
    'share_of_population_15_plus': 'population_15_plus',
}
SECTIONS = (
    (1, 'participation_rate', 'Labour force participation rate by educational attainment level (%)'),
    (9, 'employment_rate', 'Employment rate by educational attainment level (%)'),
    (17, 'unemployment_rate', 'Unemployment rate by educational attainment level (%)'),
    (25, 'share_of_labour_force', 'Distribution of labour force by educational attainment level (%)'),
    (34, 'share_of_employed', 'Distribution of employed persons by educational attainment level (%)'),
    (43, 'share_of_unemployed', 'Distribution of unemployed persons by educational attainment level (%)'),
    (52, 'share_of_outside_labour_force', 'Distribution of population outside labour force by educational attainment level (%)'),
    (61, 'share_of_population_15_plus', 'Distribution of population age 15 years and older by educational attainment level (%)'),
)
EXTRA_FIELDS = FIELDS + ('sex',)
FORMATS = ('0.0', '#,##0.0', '#\\ ##0.0')
YEARS = tuple(range(2020, 2026))
LONG_TERM_METRICS = ('long_term_unemployed', 'long_term_unemployment_rate', 'long_term_unemployed_share')


def make_row(record, sheet, cell, year, dimension, group_id, group_label, sex, metric, source_label):
    value = cell['value']
    unit = 'thousand_persons' if metric == 'long_term_unemployed' else 'percent'
    if value is not None and (not isinstance(value, Decimal) or not value.is_finite() or value < 0 or
                              (unit == 'percent' and value > 100 + RATE_TOLERANCE)):
        raise ValueError(f'Invalid source value: {record["source_id"]} {sheet} {cell}')
    if cell['format'] not in FORMATS:
        raise ValueError(f'Unexpected precision: {record["source_id"]} {sheet} {cell}')
    return dict(zip(EXTRA_FIELDS, (
        year, 'annual', dimension, group_id, group_label, metric, unit,
        '' if value is None else str(value),
        '' if value is None else str(value.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)),
        'actual', 'survey_estimate', 'ilo19_20',
        'control' if group_id == 'education.total' else 'primary',
        record['source_id'], sheet, cell['cell'], group_label, source_label, cell['format'], sex,
    )))


def annual_columns(rows, header):
    columns = [(c, int(v['value'])) for c, v in rows[header].items()
               if c != 'A' and isinstance(v['value'], Decimal)]
    if tuple(year for _, year in columns) != YEARS:
        raise ValueError(f'Unexpected annual header at row {header}')
    return columns


def extract_education(root, record):
    result = []
    for sex, sheet in SEX_SHEETS.items():
        rows = read_sheet(root / record['local_file'], sheet)
        for start, metric, expected_heading in SECTIONS:
            heading = clean(rows[start]['A']['value'])
            # The two sex-specific source sheets spell this heading as "lavel".
            if heading not in (expected_heading, expected_heading.replace(' level ', ' lavel ')):
                raise ValueError(f'Unmapped education section: {sheet} A{start}: {heading}')
            groups = RATE_GROUPS + ('Total',) if metric in RATE_METRICS else tuple(EDUCATION)
            for offset, label in enumerate(groups, start + 2):
                if clean(rows[offset]['A']['value']) != label:
                    raise ValueError(f'Unmapped education row: {sheet} A{offset}')
                for column, year in annual_columns(rows, start + 1):
                    cell = rows[offset].get(column, {'cell': f'{column}{offset}', 'value': None, 'format': '0.0'})
                    result.append(make_row(record, sheet, cell, year, 'education', EDUCATION[label], label, sex, metric, heading))
    return result


def extract_long_term(root, record):
    rows = read_sheet(root / record['local_file'])
    result = []
    expected_labels = (
        ('Number of long-term unemployed',),
        ('Long-term unemployment rate',),
        ('Share of long-term unemployeds in unemployed persons (%)',
         'Share of long-term unemployed in unemployed persons (%)'),
    )
    for sex, start in (('total', 4), ('women', 8), ('men', 12)):
        if clean(rows[start]['A']['value']) != SEX_SHEETS[sex]:
            raise ValueError(f'Unexpected long-term group at A{start}')
        for offset, metric in enumerate(LONG_TERM_METRICS, start + 1):
            label = clean(rows[offset]['A']['value'])
            if label not in expected_labels[offset - start - 1]:
                raise ValueError(f'Unexpected long-term indicator at A{offset}')
            for column, year in annual_columns(rows, 3):
                cell = rows[offset].get(column, {'cell': f'{column}{offset}', 'value': None, 'format': '0.0'})
                result.append(make_row(record, '1', cell, year, 'long_term',
                                       'georgia' if sex == 'total' else sex, SEX_SHEETS[sex], sex, metric, label))
    return result


def compare(checks, failures, name, key, actual, expected, tolerance):
    if actual is None or expected is None:
        failures.append({'check': name, 'key': key, 'reason': 'missing input'})
        return
    difference = abs(actual - expected)
    check = {'check': name, 'key': key, 'difference': str(difference),
             'tolerance': str(tolerance), 'passed': difference <= tolerance}
    checks.append(check)
    if not check['passed']:
        failures.append(check)


def validate(education, long_term, base_groups):
    checks, failures, index = [], [], {}
    for row in education + long_term:
        key = (row['dimension'], int(row['year']), row['sex'], row['group_id'], row['indicator_id'])
        if key in index:
            raise ValueError(f'Duplicate supplemental observation: {key}')
        index[key] = Decimal(row['value']) if row['value'] else None

    def get(dimension, year, sex, group, metric):
        return index.get((dimension, year, sex, group, metric))

    counts_by_class = {}
    for year in YEARS:
        for sex in SEX_SHEETS:
            reference = base_groups[('national', year, 'georgia') if sex == 'total' else ('sex', year, sex)]
            for metric in RATE_METRICS:
                compare(checks, failures, 'education_total_rate', (year, sex, metric),
                        get('education', year, sex, 'education.total', metric), reference.get(metric), RATE_TOLERANCE)
            for share_metric, count_metric in SHARE_COUNTS.items():
                shares = [get('education', year, sex, group, share_metric)
                          for group in EDUCATION.values() if group != 'education.total']
                compare(checks, failures, 'education_distribution_sum', (year, sex, share_metric),
                        None if None in shares else sum(shares), Decimal(100), RATE_TOLERANCE)
                compare(checks, failures, 'education_distribution_total', (year, sex, share_metric),
                        get('education', year, sex, 'education.total', share_metric), Decimal(100), RATE_TOLERANCE)
            for group in EDUCATION.values():
                if group == 'education.total':
                    continue
                shares = {count: get('education', year, sex, group, metric) for metric, count in SHARE_COUNTS.items()}
                if any(value is None for value in shares.values()) or any(reference.get(count) is None for count in shares):
                    failures.append({'check': 'education_count_controls', 'key': (year, sex, group), 'reason': 'missing input'})
                    continue
                # Temporary count controls, never exported as published education counts.
                derived = {count: reference[count] * share / 100 for count, share in shares.items()}
                counts_by_class[(year, sex, group)] = derived
                lf, employed, unemployed, population, outside = [derived[m] for m in
                    ('labour_force', 'employed', 'unemployed', 'population_15_plus', 'outside_labour_force')]
                compare(checks, failures, 'education_labour_force_identity', (year, sex, group), lf,
                        employed + unemployed, COUNT_TOLERANCE)
                compare(checks, failures, 'education_population_identity', (year, sex, group), population,
                        lf + outside, COUNT_TOLERANCE)
                if group == 'education.no_education':
                    continue  # The source does not publish rates for this category.
                if lf <= 0 or population <= 0:
                    failures.append({'check': 'education_positive_denominator', 'key': (year, sex, group)})
                    continue
                for metric, numerator, denominator in (
                        ('unemployment_rate', unemployed, lf), ('employment_rate', employed, population),
                        ('participation_rate', lf, population)):
                    compare(checks, failures, 'education_rate_from_distribution_controls', (year, sex, group, metric),
                            get('education', year, sex, group, metric), numerator / denominator * 100, RATE_TOLERANCE)
                participation = get('education', year, sex, group, 'participation_rate')
                employment = get('education', year, sex, group, 'employment_rate')
                expected = None if participation is None or participation <= 0 or employment is None else (1 - employment / participation) * 100
                compare(checks, failures, 'education_rate_identity', (year, sex, group),
                        get('education', year, sex, group, 'unemployment_rate'), expected, RATE_TOLERANCE)

            group_id = 'georgia' if sex == 'total' else sex
            count = get('long_term', year, sex, group_id, 'long_term_unemployed')
            for metric, denominator_metric in (('long_term_unemployment_rate', 'labour_force'),
                                              ('long_term_unemployed_share', 'unemployed')):
                denominator = reference.get(denominator_metric)
                expected = None if count is None or denominator is None or denominator <= 0 else count / denominator * 100
                compare(checks, failures, 'long_term_denominator', (year, sex, metric),
                        get('long_term', year, sex, group_id, metric), expected, RATE_TOLERANCE)
            excess = None if count is None or reference.get('unemployed') is None else max(Decimal(0), count - reference['unemployed'])
            compare(checks, failures, 'long_term_subset_of_unemployed', (year, sex), excess, Decimal(0), COUNT_TOLERANCE)

        women = get('long_term', year, 'women', 'women', 'long_term_unemployed')
        men = get('long_term', year, 'men', 'men', 'long_term_unemployed')
        compare(checks, failures, 'long_term_sex_sum', year,
                None if women is None or men is None else women + men,
                get('long_term', year, 'total', 'georgia', 'long_term_unemployed'), COUNT_TOLERANCE)
        for group in EDUCATION.values():
            if group == 'education.total':
                continue
            for metric in SHARE_COUNTS.values():
                controls = [counts_by_class.get((year, sex, group), {}).get(metric) for sex in SEX_SHEETS]
                compare(checks, failures, 'education_sex_count_controls', (year, group, metric),
                        None if None in controls else controls[1] + controls[2], controls[0], COUNT_TOLERANCE)
    return checks, failures


def collect(root, manifest, base_groups):
    education_record = next(r for r in manifest if r['source_id'] == 'geostat_lfs_annual_education')
    long_term_record = next(r for r in manifest if r['source_id'] == 'geostat_lfs_annual_long_term')
    education = extract_education(root, education_record)
    long_term = extract_long_term(root, long_term_record)
    education.sort(key=lambda r: (r['year'], r['sex'], r['group_id'], r['indicator_id']))
    long_term.sort(key=lambda r: (r['year'], r['sex'], r['indicator_id']))
    checks, failures = validate(education, long_term, base_groups)
    rates = [r for r in education if r['role'] == 'primary' and r['indicator_id'] in RATE_METRICS]
    unpublished = [{'year': year, 'sex': sex, 'group_id': 'education.no_education', 'indicator_id': metric,
                    'reason': 'Rate row not published in the official source'}
                   for year in YEARS for sex in SEX_SHEETS for metric in RATE_METRICS]
    gaps = [{'source_id': r['source_id'], 'source_sheet': r['source_sheet'], 'source_cell': r['source_cell']}
            for r in education + long_term if not r['value']]
    report = {
        'status': 'passed' if not failures and not gaps else 'failed', 'year_min': YEARS[0], 'year_max': YEARS[-1],
        'education_source_observation_count': len(education), 'education_primary_rate_observation_count': len(rates),
        'education_group_year_sex_records': len({(r['year'], r['sex'], r['group_id']) for r in rates}),
        'long_term_observation_count': len(long_term), 'long_term_group_year_records': len({(r['year'], r['sex']) for r in long_term}),
        'source_observation_count': len(education) + len(long_term), 'primary_observation_count': len(rates) + len(long_term),
        'education_unpublished_rate_combinations': len(unpublished), 'unpublished_rates': unpublished,
        'gaps': gaps, 'duplicate_keys': 0, 'imputed_values': 0, 'check_count': len(checks),
        'failed_check_count': len(failures), 'failures': failures,
        'limitations': [
            'Both additional workbooks publish only 2020-2025; no earlier observations are invented.',
            'Education has percentage rates and distributions, with no published absolute counts per education level.',
            'No education has distribution shares only; its three rates are unpublished.',
            'Count controls reconstructed from shares are used for validation only and are not exported as official counts.',
            'Long-term unemployment means unemployed for 12 months or more.',
            'Long-term rate uses labour force; long-term share uses all unemployed persons. These percentages are different measures.',
        ],
    }
    education_summary = []
    for year in YEARS:
        for sex in SEX_SHEETS:
            for label in RATE_GROUPS:
                group = EDUCATION[label]
                rows = {r['indicator_id']: r for r in rates
                        if r['year'] == year and r['sex'] == sex and r['group_id'] == group}
                education_summary.append({'year': year, 'sex': sex, 'education_level': label,
                    **{metric + '_pct': rows[metric]['published_value'] for metric in RATE_METRICS},
                    'source_sheet': rows['unemployment_rate']['source_sheet'],
                    'unemployment_rate_source_cell': rows['unemployment_rate']['source_cell']})
    long_term_summary = []
    for year in YEARS:
        for sex in SEX_SHEETS:
            rows = {r['indicator_id']: r for r in long_term if r['year'] == year and r['sex'] == sex}
            long_term_summary.append({'year': year, 'sex': sex,
                'long_term_unemployed_thousand': rows['long_term_unemployed']['published_value'],
                'long_term_unemployment_rate_pct': rows['long_term_unemployment_rate']['published_value'],
                'long_term_share_of_unemployed_pct': rows['long_term_unemployed_share']['published_value'],
                'count_source_cell': rows['long_term_unemployed']['source_cell'],
                'rate_source_cell': rows['long_term_unemployment_rate']['source_cell'],
                'share_source_cell': rows['long_term_unemployed_share']['source_cell']})
    coverage = []
    for dataset, data in (('education', rates), ('long_term', long_term)):
        for sex, group in sorted({(r['sex'], r['group_id']) for r in data}):
            years = sorted({r['year'] for r in data if r['sex'] == sex and r['group_id'] == group})
            coverage.append({'dataset': dataset, 'sex': sex, 'group_id': group,
                             'year_min': years[0], 'year_max': years[-1], 'year_count': len(years)})
    products = {
        'education-annual.csv': csv_bytes(rates, EXTRA_FIELDS),
        'education-source-observations.csv': csv_bytes(education, EXTRA_FIELDS),
        'long-term-unemployment-annual.csv': csv_bytes(long_term, EXTRA_FIELDS),
        'education-summary.csv': csv_bytes(education_summary, tuple(education_summary[0])),
        'long-term-unemployment-summary.csv': csv_bytes(long_term_summary, tuple(long_term_summary[0])),
        'supplemental-coverage.csv': csv_bytes(coverage, tuple(coverage[0])),
        'supplemental-unpublished-rates.csv': csv_bytes(unpublished, tuple(unpublished[0])),
        'supplemental-reconciliation.csv': csv_bytes([{**c, 'key': '|'.join(map(str, c['key'])) if isinstance(c['key'], tuple) else str(c['key'])}
                                                     for c in checks], ('check', 'key', 'difference', 'tolerance', 'passed')),
        'supplemental-validation-report.json': (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
    }
    return products, report
