import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DeviceSummary, ReportPage, ReportSnapshot } from "@/domain/reports/snapshot";
import { formatMs, formatVital, rateScore } from "@/domain/vitals/thresholds";

const INK = "#1f2a2e";
const MUTED = "#5f6b70";
const RULE = "#d9dcd6";
const RATING_COLOR = { good: "#1f7a4d", "needs-improvement": "#a4660a", poor: "#b3261e" };
const RATING_LABEL = { good: "Good", "needs-improvement": "Needs work", poor: "Poor" };

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  band: { height: 6, marginBottom: 18 },
  brand: { fontSize: 9, color: MUTED, letterSpacing: 1 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 4 },
  subtitle: { color: MUTED, marginTop: 4 },
  section: { marginTop: 20 },
  heading: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  card: { borderWidth: 1, borderColor: RULE, borderRadius: 4, padding: 10, marginBottom: 10 },
  pageTitle: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  url: { color: MUTED, fontSize: 8, marginTop: 2 },
  devices: { flexDirection: "row", marginTop: 8 },
  device: { flex: 1, paddingRight: 10 },
  deviceLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase" },
  score: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2 },
  line: { marginTop: 2 },
  fix: { marginTop: 2, color: INK },
  table: { borderWidth: 1, borderColor: RULE, borderRadius: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: RULE },
  cell: { flex: 1, padding: 6 },
  headCell: { flex: 1, padding: 6, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: MUTED },
});

const value = (name: "lcp" | "inp" | "cls" | "tbt", v: number | null) => (v === null ? "No data" : formatVital(name, v));

function Device({ label, summary }: { label: string; summary: DeviceSummary | null }) {
  if (!summary) {
    return (
      <View style={styles.device}>
        <Text style={styles.deviceLabel}>{label}</Text>
        <Text style={styles.line}>Not tested</Text>
      </View>
    );
  }
  const rating = rateScore(summary.score);
  return (
    <View style={styles.device}>
      <Text style={styles.deviceLabel}>{label}</Text>
      <Text style={[styles.score, { color: RATING_COLOR[rating] }]}>
        {summary.score} <Text style={{ fontSize: 9 }}>{RATING_LABEL[rating]}</Text>
      </Text>
      <Text style={styles.line}>
        Real users{summary.fieldScope === "origin" ? " (whole site)" : ""}: LCP {value("lcp", summary.field.lcp)}, INP{" "}
        {value("inp", summary.field.inp)}, CLS {value("cls", summary.field.cls)}
      </Text>
      <Text style={styles.line}>
        Lab: LCP {value("lcp", summary.lab.lcp)}, TBT {value("tbt", summary.lab.tbt)}
      </Text>
      {summary.topFixes.slice(0, 3).map((fix) => (
        <Text key={fix.title} style={styles.fix}>
          - {fix.title} (~{formatMs(fix.savingsMs)})
        </Text>
      ))}
    </View>
  );
}

function PageCard({ page }: { page: ReportPage }) {
  return (
    <View style={styles.card} wrap={false}>
      <Text style={styles.pageTitle}>{page.label ?? page.url}</Text>
      {page.label && <Text style={styles.url}>{page.url}</Text>}
      <View style={styles.devices}>
        <Device label="Mobile" summary={page.mobile} />
        <Device label="Desktop" summary={page.desktop} />
      </View>
    </View>
  );
}

function ReportDocument({ snapshot }: { snapshot: ReportSnapshot }) {
  const generated = new Date(snapshot.generatedAt).toUTCString().replace(" GMT", " UTC");
  const everyone = [...snapshot.pages.slice(0, 1), ...snapshot.competitors];

  return (
    <Document title={`${snapshot.projectName} performance report`} author="VitalWatch">
      <Page size="A4" style={styles.page}>
        <View style={[styles.band, { backgroundColor: snapshot.brandColor }]} />
        <Text style={styles.brand}>VITALWATCH PERFORMANCE REPORT</Text>
        <Text style={styles.title}>{snapshot.projectName}</Text>
        <Text style={styles.subtitle}>Generated {generated}. Data from Google PageSpeed Insights.</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Pages</Text>
          {snapshot.pages.map((page) => (
            <PageCard key={page.url} page={page} />
          ))}
        </View>

        {snapshot.competitors.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.heading}>Against competitors (mobile)</Text>
            <View style={styles.table}>
              <View style={styles.row}>
                <Text style={styles.headCell}>Site</Text>
                <Text style={styles.headCell}>Score</Text>
                <Text style={styles.headCell}>LCP (real users)</Text>
                <Text style={styles.headCell}>CLS (real users)</Text>
              </View>
              {everyone.map((page, index) => (
                <View key={page.url} style={styles.row}>
                  <Text style={styles.cell}>
                    {page.label ?? new URL(page.url).hostname}
                    {index === 0 ? " (yours)" : ""}
                  </Text>
                  <Text style={styles.cell}>{page.mobile?.score ?? "Not tested"}</Text>
                  <Text style={styles.cell}>{page.mobile ? value("lcp", page.mobile.field.lcp) : "-"}</Text>
                  <Text style={styles.cell}>{page.mobile ? value("cls", page.mobile.field.cls) : "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `VitalWatch  |  ${snapshot.projectName}  |  Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export function renderReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  return renderToBuffer(<ReportDocument snapshot={snapshot} />);
}
