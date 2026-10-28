/**
 * Troca o ícone e as informações de versão do executável do Electron (MotionCut.exe).
 * Usa o resedit (JavaScript puro), então funciona no Linux sem Wine/rcedit.
 * Uso: node desktop/set-exe-resources.mjs <exe> <icon.ico> <versão>
 */
import fs from 'node:fs';
import * as ResEdit from 'resedit';

const [exePath, icoPath, version] = process.argv.slice(2);
const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);

const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const target = groups[0] || { id: 1, lang: 1033 };
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, target.id, target.lang, ico.icons.map((i) => i.data));

const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
const [major, minor, patch] = version.split('.').map((n) => parseInt(n, 10) || 0);
vi.setFileVersion(major, minor, patch, 0);
vi.setProductVersion(major, minor, patch, 0);
const lang = vi.getAllLanguagesForStringValues()[0] || { lang: 1033, codepage: 1200 };
vi.setStringValues(lang, {
  ProductName: 'MotionCut',
  FileDescription: 'MotionCut — editor de vídeo com IA Motion',
  CompanyName: 'MotionCut',
  InternalName: 'MotionCut',
  OriginalFilename: 'MotionCut.exe',
  LegalCopyright: 'MotionCut',
  FileVersion: version,
  ProductVersion: version,
});
vi.outputToResourceEntries(res.entries);
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log(`✔ ícone e versão ${version} aplicados em ${exePath}`);
