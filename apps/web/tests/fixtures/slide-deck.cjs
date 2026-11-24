// Solid fills make the current slide and the private preview distinguishable
// in independent pixel samples of a captured track or exported recording.
function slideDeck(fills) {
  const references = fills.map((_, index) => (3 + index * 2) + ' 0 R').join(' ');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [' + references + '] /Count ' + fills.length + ' >>'];
  for (const [index, fill] of fills.entries()) {
    const content = fill + ' rg 0 0 640 360 re f\n';
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Resources << >> /Contents ' + (4 + index * 2) + ' 0 R >>',
      '<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  }
  const xref = pdf.length;
  pdf += 'xref\n0 ' + offsets.length + '\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  return Buffer.from(pdf + 'trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
}
module.exports = { slideDeck };
