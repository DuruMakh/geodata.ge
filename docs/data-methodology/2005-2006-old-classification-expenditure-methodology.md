# 2004-2006 Expenditure Final Data Methodology (pre-COFOG old classification)

Status: implemented and reconciled (reviewed 2026-08-20)

Scope: national budget expenditure, actual execution, 2004–2006

2004–2006 predate Georgia's adoption of the COFOG functional classification
(which begins in 2007, see `2007-2016-expenditure-final-methodology.md`). The
2005–2006 Treasury E11 tables use the older **14-group functional
classification**, so they need a dedicated parser and a dedicated group ->
public-category mapping rather than the COFOG pipeline. For 2004, the complete
state-budget execution annex, rather than the narrower central-budget Treasury
E11, supplies the functional parents and exact carve-outs.

## 1. Sources

```text
2005 E11 (treasury): docs/Raw Data/Expenditure/treasury.ge/2005-12-month-state-budget-functional-expenditure.pdf
  SHA-256: BFC38ACBD91515A224AC9148635537C163662D4BB36E2AD28C963D33FA4F9622
  Legacy ASCII-transliteration Georgian font; thousand-GEL amounts (one
  decimal, "-" for zero); codes NN / NN NN / NN NN NN; seven amount columns.

2006 E11 (treasury): docs/Raw Data/Expenditure/treasury.ge/2006-12-month-state-budget-functional-expenditure.pdf
  SHA-256: 5088EDA02D6C4DA13B3D2C70E7C6C8781C41207DAEB3538E033B34F5EADF6EF2
  Unicode Georgian labels; GEL amounts (two decimals); codes "NN NN NN" alone
  on their own line; six amount columns.
```

Reconciliation targets come from the mof.ge annual execution reports
(retrieved via the Internet Archive from the old-site "12 თვე" pages):

```text
docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2005-annual-execution-report.pdf
  mof.ge doc 8907 (year page /5037 -> /5043). Grand payments actual:
  "sul saxelmwifo biujetis gadasaxdelebi da xarjebi ... 2,626,507.3" thousand GEL.
  archived copy: http://web.archive.org/web/20140813154735/http://www.mof.ge/common/get_doc.aspx?doc_id=8907
  SHA-256: 3CDE917ADDD4CF2F689639E386AB706BC2F4A9BAE9F01F21AAB1994273FD5DE8

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2006-annual-execution-report.pdf
  mof.ge doc 8905 (year page /5033 -> /5041). Grand payments actual:
  "biujetis gadasaxdelebi 3,878,542.0 3,822,512.6 98.6%" thousand GEL.
  archived copy: http://web.archive.org/web/20130729120331/http://www.mof.ge/common/get_doc.aspx?doc_id=8905
  SHA-256: 306841DBD25C9A7BECB071AA0307D8E4E37FF3817E3555D8B503A279507F50B3
```

Column concept: both years use the **payments** column (გადასახდელები,
including net lending and debt repayment), the same concept used from 2007 on.
For 2005 that is column index 1 (2,626,507.3k); the source row also carries a
narrower 12-month expenditure column (2,618,557.0k) which is not used. For 2006
the report explicitly labels the actual payments column (3,822,512.6k), which is
column index 2 of the six.

## 2. Parser

`apps/web/lib/data/realExpenditurePdf/oldClassificationExpenditurePdf.ts`
extracts every coded functional row keyed by a normalized `group.sub.leaf`
code, taking the payment column per the dialect. Internal validation: the
fourteen (2005) / thirteen (2006 — no housing group that year) `NN 00 00`
group totals sum to the official grand total **exactly** (difference 0.00 GEL
in both years).

## 3. Mapping (old 14-group -> public category)

The old groups are the predecessors of the COFOG divisions, so the mapping is
the direct analogue of the COFOG rules in `publicMapping.ts`. Each group maps
to a dominant public category; four sub-codes are carved out to their own
category. Allocation is **group total minus carve-outs**, so category totals
always sum to the group totals, which sum to the grand total.

| Old group | Dominant category |
|---|---|
| 1 საერთო დანიშნულების | general_public_services |
| 2 თავდაცვა | defence |
| 3 საზ. წესრიგი და უშიშროება | public_order_safety |
| 4 განათლება | education |
| 5 ჯანმრთელობის დაცვა | health |
| 6 სოც. დაზღვევა/უზრუნველყოფა | social_protection |
| 7 საბინაო-კომუნალური | infrastructure_regional_development |
| 8 კულტურა/სპორტი/რელიგია | culture |
| 9 სათბობ-ენერგეტიკა | economic_affairs |
| 10 სოფლის/სატყეო/მეთევზ. | agriculture_environment |
| 11 მრეწველობა/მშენებლობა | economic_affairs |
| 12 ტრანსპორტი/კავშირგაბ. | infrastructure_regional_development |
| 13 გარემო + სხვა ეკონ. | economic_affairs |
| 14 არაკლასიფიცირებული | other_unclassified |

Carve-outs (added to the target category, subtracted from the parent group's
dominant category):

| Sub-code | -> Category | Rationale |
|---|---|---|
| `08 01 01` სპორტი | sport | COFOG 7.8.1 splits sport from culture |
| `13 05` გარემოს დაცვა | agriculture_environment | COFOG 7.5 environment, out of the mixed economic group |
| `14 01` ვალდებულებებით ოპერაციები | debt_service | COFOG 7.1.6 debt operations |
| `14 02` ტრანსფერები | infrastructure_regional_development | COFOG 7.1.7 intergovernmental flows |

Group 12 is mapped whole to infrastructure (transport-dominant; any
communications sub-activity is minor and not separated at group level). The
per-group and per-carve-out allocation is written to
`data/mappings/review/spending-field-mapping-review-<year>-old-classification.csv`
for review.

## 4. Reconciliation results

```text
2004
  Category total = official payments total = 1,930,210,300 GEL (difference 0)
  Rounded full-state groups = 1,930,210,400 GEL; -100 GEL is applied only to other/unclassified
  Exact annex carve-outs: sport 6,866,000; debt operations 291,350,100;
  intergovernmental transfers 128,234,000 GEL
2005
  Category total = official payments total = 2,626,507,300 GEL (difference 0)
2006
  Category total = official payments total = 3,822,512,626 GEL (difference 0)
```

`spending.other_unclassified` = 2,057,900 GEL (2005) and 20,414,380 GEL (2006):
the residual of group 14 after debt and transfers are carved out
(`14 03 სხვა ხარჯები` — genuinely unclassified in the source). Category
distributions match the reports' narrative figures (e.g. 2005 education
77,694.3k; 2005 defence 389,292.6k; 2006 payments 3,822,512.6k).

Regression pins live in `apps/web/tests/data/pipelineIntegration.test.ts`.

## 5. Verification commands

```powershell
cd apps/web
npm run data:generate-final-2004-expenditure
npm run data:generate-final-2005-expenditure
npm run data:generate-final-2006-expenditure
npm run data:compose-budget-facts
npm run data:validate
npm test
```

## 6. 2004 complete-state mapping

The complete execution annex's functional table on page 232 is the canonical 2004 source.
All fourteen full-state parents use the same reviewed group-to-category mapping as the
2005–2006 old classification. The source-derived sport, debt, and intergovernmental-transfer
lines are carved out exactly before their parent remainders are classified. The annex's
rounded group values are GEL 100 above the printed GEL 1,930,210,300 total; the explicit
negative GEL 100 adjustment is confined to `spending.other_unclassified`.

The separate Treasury E11 remains archived as central-budget-only corroboration. It supplies
neither a served 2004 fact nor a generated mapping-review amount.
