/* Web Toolkit: all tools run in the browser with plain JavaScript (no libraries). */

const $ = (id) => document.getElementById(id);

/* ---------- Shared helpers ---------- */
function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1800);
}

async function copyText(text) {
  if (!text) return toast("Nothing to copy");
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast("Copy failed. Select the text and press Ctrl+C");
  }
}

function debounce(fn, ms = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ---------- Tabs and theme ---------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".tool").forEach((s) => s.classList.toggle("active", s.id === tab.dataset.tool));
    history.replaceState(null, "", "#" + tab.dataset.tool);
  });
});
const startTool = location.hash.slice(1);
if (startTool) document.querySelector(`.tab[data-tool="${startTool}"]`)?.click();

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
});
if (localStorage.getItem("theme") === "dark") document.body.classList.add("dark");

/* ---------- 1. Word counter ---------- */
const STOP_WORDS = new Set("the a an and or but of to in on at for with is are was were be been it this that as by from i you he she we they my your".split(" "));

function analyseText(text) {
  const words = text.match(/[A-Za-z0-9À-ɏ'’-]+/g) || [];
  const sentences = text.split(/[.!?]+(\s|$)/).filter((s) => s && s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const freq = {};
  words.forEach((w) => {
    const k = w.toLowerCase();
    if (k.length > 2 && !STOP_WORDS.has(k)) freq[k] = (freq[k] || 0) + 1;
  });
  return {
    words: words.length,
    chars: text.length,
    noSpace: text.replace(/\s/g, "").length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    readingMinutes: Math.ceil(words.length / 200), // average adult reads ~200 words per minute
    top: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}

$("wordInput").addEventListener("input", debounce((e) => {
  const r = analyseText(e.target.value);
  $("wcWords").textContent = r.words.toLocaleString();
  $("wcChars").textContent = r.chars.toLocaleString();
  $("wcNoSpace").textContent = r.noSpace.toLocaleString();
  $("wcSentences").textContent = r.sentences;
  $("wcParas").textContent = r.paragraphs;
  $("wcRead").textContent = r.readingMinutes + " min";
  $("wcTop").innerHTML = r.top.length
    ? r.top.map(([w, n]) => `<li><b>${w}</b>: ${n}</li>`).join("")
    : '<li class="muted">Type some text to see results</li>';
}));

/* ---------- 2. Password generator ---------- */
const SETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?",
};
const SIMILAR = /[0O1lI|]/g;

function secureRandomInt(max) {
  // crypto.getRandomValues is cryptographically secure, unlike Math.random
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max; // avoid modulo bias
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}

function generatePassword(length, opts) {
  let pools = Object.keys(SETS).filter((k) => opts[k]).map((k) => SETS[k]);
  if (opts.avoidSimilar) pools = pools.map((p) => p.replace(SIMILAR, ""));
  if (!pools.length) return "";
  // guarantee at least one character from every selected set
  const chars = pools.map((p) => p[secureRandomInt(p.length)]);
  const all = pools.join("");
  while (chars.length < length) chars.push(all[secureRandomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { // Fisher-Yates shuffle
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function passwordStrength(pw, poolSize) {
  const bits = pw.length * Math.log2(Math.max(poolSize, 1)); // entropy
  if (bits < 40) return { label: "Weak", pct: 25, color: "var(--bad)", bits };
  if (bits < 60) return { label: "Fair", pct: 50, color: "var(--warn)", bits };
  if (bits < 80) return { label: "Strong", pct: 75, color: "var(--good)", bits };
  return { label: "Very strong", pct: 100, color: "var(--good)", bits };
}

function refreshPassword() {
  const opts = {
    upper: $("pwUpper").checked, lower: $("pwLower").checked,
    digits: $("pwDigits").checked, symbols: $("pwSymbols").checked,
    avoidSimilar: $("pwSimilar").checked,
  };
  const length = +$("pwLength").value;
  $("pwLenLabel").textContent = length;
  const pw = generatePassword(length, opts);
  $("pwOutput").value = pw || "Select at least one option";
  let pool = Object.keys(SETS).filter((k) => opts[k]).map((k) => SETS[k]).join("");
  if (opts.avoidSimilar) pool = pool.replace(SIMILAR, "");
  const s = passwordStrength(pw, pool.length);
  $("pwMeter").style.width = pw ? s.pct + "%" : "0";
  $("pwMeter").style.background = s.color;
  $("pwStrength").textContent = pw ? `${s.label} · about ${Math.round(s.bits)} bits of entropy` : "";
  $("pwStrength").style.color = s.color;
}
["pwLength", "pwUpper", "pwLower", "pwDigits", "pwSymbols", "pwSimilar"].forEach((id) => $(id).addEventListener("input", refreshPassword));
$("pwNew").addEventListener("click", refreshPassword);
$("pwCopy").addEventListener("click", () => copyText($("pwOutput").value));
refreshPassword();

/* ---------- 3. Unit converter ---------- */
// Each unit stores its factor to the base unit of its category.
const UNITS = {
  Length: { base: "Metre", units: { Millimetre: 0.001, Centimetre: 0.01, Metre: 1, Kilometre: 1000, Inch: 0.0254, Foot: 0.3048, Yard: 0.9144, Mile: 1609.344 } },
  Weight: { base: "Kilogram", units: { Milligram: 1e-6, Gram: 0.001, Kilogram: 1, Tonne: 1000, Ounce: 0.028349523125, Pound: 0.45359237 } },
  Temperature: { units: { Celsius: null, Fahrenheit: null, Kelvin: null } },
  Area: { base: "Square metre", units: { "Square metre": 1, "Square foot": 0.09290304, Acre: 4046.8564224, Hectare: 10000, "Square kilometre": 1e6 } },
  Speed: { base: "m/s", units: { "m/s": 1, "km/h": 1 / 3.6, mph: 0.44704, Knot: 0.514444 } },
  "Data size": { base: "Byte", units: { Bit: 0.125, Byte: 1, Kilobyte: 1024, Megabyte: 1024 ** 2, Gigabyte: 1024 ** 3, Terabyte: 1024 ** 4 } },
};

function convertTemperature(value, from, to) {
  const toC = { Celsius: (v) => v, Fahrenheit: (v) => (v - 32) * 5 / 9, Kelvin: (v) => v - 273.15 };
  const fromC = { Celsius: (v) => v, Fahrenheit: (v) => v * 9 / 5 + 32, Kelvin: (v) => v + 273.15 };
  return fromC[to](toC[from](value));
}

function convertUnit(category, value, from, to) {
  if (category === "Temperature") return convertTemperature(value, from, to);
  const u = UNITS[category].units;
  return (value * u[from]) / u[to];
}

function formatNumber(n) {
  if (!isFinite(n)) return "";
  if (Math.abs(n) >= 1e9 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4);
  return parseFloat(n.toPrecision(10)).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fillUnitSelects() {
  const names = Object.keys(UNITS[$("unitCategory").value].units);
  $("unitFrom").innerHTML = $("unitTo").innerHTML = names.map((n) => `<option>${n}</option>`).join("");
  $("unitTo").selectedIndex = Math.min(1, names.length - 1);
  runUnitConversion();
}

function runUnitConversion() {
  const cat = $("unitCategory").value, from = $("unitFrom").value, to = $("unitTo").value;
  const value = parseFloat($("unitFromValue").value);
  if (isNaN(value)) { $("unitToValue").value = ""; $("unitFormula").textContent = ""; return; }
  const result = convertUnit(cat, value, from, to);
  $("unitToValue").value = formatNumber(result);
  $("unitFormula").textContent = `${formatNumber(value)} ${from} = ${formatNumber(result)} ${to}`;
}

$("unitCategory").innerHTML = Object.keys(UNITS).map((c) => `<option>${c}</option>`).join("");
$("unitCategory").addEventListener("change", fillUnitSelects);
["unitFrom", "unitTo"].forEach((id) => $(id).addEventListener("change", runUnitConversion));
$("unitFromValue").addEventListener("input", runUnitConversion);
$("unitSwap").addEventListener("click", () => {
  const from = $("unitFrom").value;
  $("unitFrom").value = $("unitTo").value;
  $("unitTo").value = from;
  runUnitConversion();
});
fillUnitSelects();

/* ---------- 4. JSON formatter ---------- */
function jsonErrorPosition(text, message) {
  const m = message.match(/position (\d+)/);
  if (!m || /line \d+/.test(message)) return ""; // newer browsers already include the line
  const pos = +m[1];
  const before = text.slice(0, pos).split("\n");
  return ` (line ${before.length}, column ${before[before.length - 1].length + 1})`;
}

function processJson(minify) {
  const text = $("jsonInput").value.trim();
  const status = $("jsonStatus");
  if (!text) { status.textContent = "Paste some JSON first."; status.className = "status err"; return; }
  try {
    const data = JSON.parse(text);
    const indent = $("jsonIndent").value === "tab" ? "\t" : +$("jsonIndent").value;
    $("jsonOutput").textContent = minify ? JSON.stringify(data) : JSON.stringify(data, null, indent);
    const kind = Array.isArray(data) ? `array with ${data.length} items` : typeof data === "object" && data ? `object with ${Object.keys(data).length} keys` : typeof data;
    status.textContent = `✔ Valid JSON: ${kind}`;
    status.className = "status ok";
  } catch (err) {
    $("jsonOutput").textContent = "";
    status.textContent = "✖ Invalid JSON: " + err.message + jsonErrorPosition(text, err.message);
    status.className = "status err";
  }
}
$("jsonFormat").addEventListener("click", () => processJson(false));
$("jsonMinify").addEventListener("click", () => processJson(true));
$("jsonCopy").addEventListener("click", () => copyText($("jsonOutput").textContent));
$("jsonSample").addEventListener("click", () => {
  $("jsonInput").value = '{"name":"Shubham Sharma","role":"Data Analyst","skills":["Python","SQL","Power BI","Excel"],"experience":[{"company":"Fingertips","type":"Full-time"},{"company":"Celebal Technologies","type":"Internship"}],"available":true}';
  processJson(false);
});

/* ---------- 5. Age calculator ---------- */
function calculateAge(dob, on) {
  let months = (on.getFullYear() - dob.getFullYear()) * 12 + (on.getMonth() - dob.getMonth());
  if (on.getDate() < dob.getDate()) months -= 1;
  // anchor = date of birth moved forward by whole months (clamped to the end of short months)
  const addMonths = (d, n) => {
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay));
  };
  let anchor = addMonths(dob, months);
  if (anchor > on) { months -= 1; anchor = addMonths(dob, months); }
  const years = Math.floor(months / 12);
  const days = Math.round((on - anchor) / 86400000);
  months = months % 12;
  const totalDays = Math.round((on - dob) / 86400000);
  let next = new Date(on.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < on) next = new Date(on.getFullYear() + 1, dob.getMonth(), dob.getDate());
  const daysToBirthday = Math.round((next - on) / 86400000);
  return { years, months, days, totalDays, weeks: Math.floor(totalDays / 7), daysToBirthday, weekday: dob.toLocaleDateString("en-IN", { weekday: "long" }) };
}

function parseDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const today = new Date();
$("ageOn").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
$("ageCalc").addEventListener("click", () => {
  if (!$("ageDob").value) return toast("Please choose a date of birth");
  const dob = parseDate($("ageDob").value), on = $("ageOn").value ? parseDate($("ageOn").value) : new Date();
  if (dob > on) return toast("Date of birth must be before the 'Age on' date");
  const a = calculateAge(dob, on);
  $("ageResult").innerHTML = `
    <div class="big">${a.years} years, ${a.months} months, ${a.days} days</div>
    <div class="cell"><b>${a.totalDays.toLocaleString()}</b><span>Total days</span></div>
    <div class="cell"><b>${a.weeks.toLocaleString()}</b><span>Total weeks</span></div>
    <div class="cell"><b>${a.daysToBirthday === 0 ? "Today! 🎉" : a.daysToBirthday}</b><span>Days to next birthday</span></div>
    <div class="cell" style="grid-column:1/-1"><b>${a.weekday}</b><span>Day of the week you were born</span></div>`;
});

/* ---------- 6. Case converter ---------- */
function splitWords(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // split camelCase
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

const CASES = {
  upper: (t) => t.toUpperCase(),
  lower: (t) => t.toLowerCase(),
  title: (t) => t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
  sentence: (t) => t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase()),
  camel: (t) => splitWords(t).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join(""),
  pascal: (t) => splitWords(t).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(""),
  snake: (t) => splitWords(t).map((w) => w.toLowerCase()).join("_"),
  kebab: (t) => splitWords(t).map((w) => w.toLowerCase()).join("-"),
};

$("caseButtons").addEventListener("click", (e) => {
  const type = e.target.dataset.case;
  if (type) $("caseInput").value = CASES[type]($("caseInput").value);
});
$("caseCopy").addEventListener("click", () => copyText($("caseInput").value));
$("caseClear").addEventListener("click", () => { $("caseInput").value = ""; });

// Expose pure functions for quick testing in the browser console
window.toolkit = { analyseText, generatePassword, convertUnit, calculateAge, CASES };
