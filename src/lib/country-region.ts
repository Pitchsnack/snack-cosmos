// Maps an ISO country name (as stored in `startups.headquarters`)
// to one of four macro regions: APAC, EMEA, LATAM, NA.
// Returns "" when the country is unknown or input is blank.

export const REGION_OPTIONS = [
  {
    value: "APAC",
    label: "APAC",
    description:
      "Asia-Pacific, including Australia, East Asia, Southeast Asia, and Oceania.",
  },
  {
    value: "EMEA",
    label: "EMEA",
    description: "Europe, the Middle East, and Africa.",
  },
  {
    value: "LATAM",
    label: "LATAM",
    description: "Latin America.",
  },
  {
    value: "NA",
    label: "NA",
    description: "North America, primarily the United States and Canada.",
  },
] as const;

export type Region = (typeof REGION_OPTIONS)[number]["value"];

const APAC = new Set([
  "Afghanistan","Australia","Bangladesh","Bhutan","Brunei","Cambodia","China",
  "Fiji","Hong Kong","India","Indonesia","Japan","Kazakhstan","Kiribati",
  "Kyrgyzstan","Laos","Macau","Malaysia","Maldives","Marshall Islands",
  "Micronesia","Mongolia","Myanmar","Nauru","Nepal","New Zealand",
  "North Korea","Pakistan","Palau","Papua New Guinea","Philippines",
  "Samoa","Singapore","Solomon Islands","South Korea","Sri Lanka",
  "Taiwan","Tajikistan","Thailand","Timor-Leste","Tonga","Turkmenistan",
  "Tuvalu","Uzbekistan","Vanuatu","Vietnam",
]);

const NA = new Set(["United States", "Canada"]);

const LATAM = new Set([
  "Antigua and Barbuda","Argentina","Bahamas","Barbados","Belize","Bolivia",
  "Brazil","Chile","Colombia","Costa Rica","Cuba","Dominica",
  "Dominican Republic","Ecuador","El Salvador","Grenada","Guatemala","Guyana",
  "Haiti","Honduras","Jamaica","Mexico","Nicaragua","Panama","Paraguay",
  "Peru","Saint Kitts and Nevis","Saint Lucia",
  "Saint Vincent and the Grenadines","Suriname","Trinidad and Tobago",
  "Uruguay","Venezuela",
]);

const EMEA = new Set([
  "Albania","Andorra","Armenia","Austria","Azerbaijan","Belarus","Belgium",
  "Bosnia and Herzegovina","Bulgaria","Croatia","Cyprus","Czech Republic",
  "Denmark","Estonia","Finland","France","Georgia","Germany","Greece",
  "Hungary","Iceland","Ireland","Italy","Latvia","Liechtenstein","Lithuania",
  "Luxembourg","Malta","Moldova","Monaco","Montenegro","Netherlands",
  "North Macedonia","Norway","Poland","Portugal","Romania","Russia",
  "San Marino","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland",
  "Turkey","Ukraine","United Kingdom","Vatican City",
  "Bahrain","Iran","Iraq","Israel","Jordan","Kuwait","Lebanon","Oman",
  "Palestine","Qatar","Saudi Arabia","Syria","United Arab Emirates","Yemen",
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cabo Verde",
  "Cameroon","Central African Republic","Chad","Comoros","Congo",
  "Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia",
  "Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Kenya","Lesotho",
  "Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius",
  "Morocco","Mozambique","Namibia","Niger","Nigeria","Rwanda",
  "Sao Tome and Principe","Senegal","Seychelles","Sierra Leone","Somalia",
  "South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda",
  "Zambia","Zimbabwe",
]);

export function regionForCountry(country: string | null | undefined): Region | "" {
  if (!country) return "";
  const c = country.trim();
  if (!c) return "";
  if (NA.has(c)) return "NA";
  if (APAC.has(c)) return "APAC";
  if (LATAM.has(c)) return "LATAM";
  if (EMEA.has(c)) return "EMEA";
  return "";
}
