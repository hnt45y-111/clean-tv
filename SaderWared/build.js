// يدمج مكتبة Excel داخل ملف HTML واحد يشتغل بدون إنترنت
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "src/app.html"), "utf8");
const lib = fs.readFileSync(path.join(__dirname, "vendor/xlsx.full.min.js"), "utf8").replace(/<\/script/gi, "<\\/script");
fs.mkdirSync(path.join(__dirname, "dist"), {recursive: true});
fs.writeFileSync(path.join(__dirname, "dist/الصادر والوارد.html"), src.replace("/*XLSX_LIB*/", () => lib));
console.log("built");
