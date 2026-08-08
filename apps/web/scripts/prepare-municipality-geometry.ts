import {
  checkMunicipalityGeometryOutputs,
  writeMunicipalityGeometryOutputs,
} from "../lib/data/municipalGeometry/prepareMunicipalGeometry";

async function main() {
  if (process.argv.includes("--check")) {
    await checkMunicipalityGeometryOutputs();
    console.log("Municipality geometry outputs are current.");
    return;
  }

  await writeMunicipalityGeometryOutputs();
  console.log("Wrote municipality geometry artifact and source manifest.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
