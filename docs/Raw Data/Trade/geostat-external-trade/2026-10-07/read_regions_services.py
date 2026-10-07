"""Registered-address regions and three separate service-table dimensions."""
from collections import defaultdict
from decimal import Decimal
import json
from model import Observation,extract_layouts,numeric_usd,source_key

def read_regions(sources: dict,layouts: list[dict],package_root) -> list[Observation]:
    return extract_layouts(sources,layouts,package_root,{'goods_regions'})

def read_services(sources: dict,layouts: list[dict],package_root) -> list[Observation]:
    return extract_layouts(sources,layouts,package_root,{'services'})

def comparison(check: str,reference: Observation,actual: Decimal | None,members: list[Observation],evidence: str,item_id: str | None=None) -> dict:
    expected=numeric_usd(reference)
    supported=expected is not None and actual is not None
    difference=actual-expected if supported else None
    return dict(check=check,family=reference['family'],flow=reference['flow'],year=reference['year'],item_id=reference['item_id'] if item_id is None else item_id,expected_usd=str(expected) if supported else '',actual_usd=str(actual) if supported else '',difference_usd=str(difference) if supported else '',tolerance_usd='1' if supported else '',status=('pass' if abs(difference)<=1 else 'fail') if supported else 'not_published',source_refs=json.dumps([source_key(reference)]+[source_key(r) for r in members],ensure_ascii=False,separators=(',',':')),evidence=evidence)

def sum_available(rows: list[Observation]) -> Decimal | None:
    values=[numeric_usd(r) for r in rows if numeric_usd(r) is not None]
    return sum(values,Decimal(0)) if values else None

def region_comparisons(rows: list[Observation]) -> list[dict]:
    result=[]; grouped=defaultdict(list)
    for row in rows:
        if row['family']=='goods_regions': grouped[(row['flow'],row['year'])].append(row)
    for period,members in sorted(grouped.items()):
        grand=next(r for r in members if r['geography_id']=='georgia' and r['item_id']=='goods.total')
        totals=[r for r in members if r['role']=='total']
        result.append(comparison('regional_total_sum',grand,sum_available(totals),totals,'All eleven named regions plus Unknown; registered-address attribution.'))
        for total in totals:
            details=[r for r in members if r['geography_id']==total['geography_id'] and r['role']=='detail']
            result.append(comparison('regional_product_sum',total,None if total['geography_id']=='region.unknown' else sum_available(details),details,'Unknown has no published product detail; it is not allocated.' if total['geography_id']=='region.unknown' else 'Only published SITC product rows; supporting legal/person cells are excluded.',total['geography_id']))
    return result

def services_comparisons(rows: list[Observation]) -> list[dict]:
    result=[]; grouped=defaultdict(list)
    for row in rows:
        if row['family']=='services': grouped[(row['flow'],row['year'])].append(row)
    for period,members in sorted(grouped.items()):
        types=[r for r in members if r['dimension']=='type']; countries=[r for r in members if r['dimension']=='country']; joint=[r for r in members if r['dimension']=='type_country']
        total=next(r for r in types if r['role']=='total'); type_rows=[r for r in types if r['role']=='detail']
        result.append(comparison('service_type_sum',total,sum_available(type_rows),type_rows,'Numeric-only sum of twelve published types; symbols/blanks remain unavailable.'))
        country_total=next(r for r in countries if r['role']=='total')
        leaves=[r for r in countries if r['role'] in ('detail','residual')]
        result.append(comparison('service_country_sum',country_total,sum_available(leaves),leaves,'Country leaves and explicit residuals only; EU/CIS/Other section subtotals excluded.'))
        result.append(comparison('service_country_total_matches_types',total,numeric_usd(country_total),[country_total],'Separate representations of the same service total.'))
        joint_total=next(r for r in joint if r['role']=='total'); subtotals=[r for r in joint if r['role']=='subtotal']
        result.append(comparison('service_joint_total_matches_types',total,numeric_usd(joint_total),[joint_total],'Type-country grand total compared once; alternative dimensions are not added.'))
        result.append(comparison('service_joint_type_sum',joint_total,sum_available(subtotals),subtotals,'Only twelve type subtotals, excluding country leaves and control rows.'))
        for subtotal in subtotals:
            detail=[r for r in joint if r['service_id']==subtotal['service_id'] and (r['role'] in ('detail','residual') or (r['role']=='supporting' and r['source_label']==''))]
            result.append(comparison('service_joint_country_sum',subtotal,sum_available(detail),detail,'Published countries/residuals plus unlabelled source remainder cells; of-which controls excluded. Unnamed amounts are not assigned to a country.'))
            matching=next(r for r in type_rows if r['service_id']==subtotal['service_id'])
            result.append(comparison('service_joint_type_matches_types',matching,numeric_usd(subtotal),[subtotal],'Published dash in the type-only table remains unavailable even if the joint table records zero.'))
        required_types={r['service_id'] for r in type_rows}
        for country in [r for r in countries if r['role']=='detail' and r['partner_code']]:
            detail=[r for r in joint if r['role']=='detail' and r['partner_code']==country['partner_code']]
            complete={r['service_id'] for r in detail if numeric_usd(r) is not None}==required_types
            result.append(comparison('service_country_matches_joint',country,sum_available(detail) if complete else None,detail,'All twelve numeric country/type counterparts are required; absent or symbolic country detail is not zero.'))
    return result
