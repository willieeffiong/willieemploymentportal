import aerospace from "@/assets/fields/aerospace.jpg";
import architectural from "@/assets/fields/architectural.jpg";
import agricultural from "@/assets/fields/agricultural.jpg";
import automotive from "@/assets/fields/automotive.jpg";
import biomedical from "@/assets/fields/biomedical.jpg";
import chemical from "@/assets/fields/chemical.jpg";
import civil from "@/assets/fields/civil.jpg";
import computer from "@/assets/fields/computer.jpg";
import electrical from "@/assets/fields/electrical.jpg";
import environmental from "@/assets/fields/environmental.jpg";
import industrial from "@/assets/fields/industrial.jpg";
import marine from "@/assets/fields/marine.jpg";
import materials from "@/assets/fields/materials.jpg";
import mechanical from "@/assets/fields/mechanical.jpg";
import mining from "@/assets/fields/mining.jpg";
import petroleum from "@/assets/fields/petroleum.jpg";
import renewable from "@/assets/fields/renewable.jpg";
import robotics from "@/assets/fields/robotics.jpg";
import software from "@/assets/fields/software.jpg";
import structural from "@/assets/fields/structural.jpg";
import telecom from "@/assets/fields/telecom.jpg";

export { NIGERIAN_STATES, NIGERIA_STATES_LGAS, lgasForState } from "./nigeria-lga";

export const QUALIFICATIONS = [
  "SSCE / WAEC",
  "OND",
  "HND",
  "B.Sc / B.Eng",
  "M.Sc / M.Eng",
  "PhD",
  "Professional Certification",
];

export const EXPERIENCE_LEVELS = [
  "None",
  "Less than 1 year",
  "1 - 2 years",
  "3 - 5 years",
  "6 - 10 years",
  "More than 10 years",
];

export const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is the name of your home town?",
  "What was your childhood nickname?",
  "What is the name of your favourite teacher?",
  "What is your father's middle name?",
];

/** Minimum and maximum words for the skills and experience descriptions. */
export const MIN_WORDS = 30;
export const MAX_WORDS = 300;

export function countWords(value: string | null | undefined): number {
  if (!value) return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export interface EngineeringField {
  name: string;
  image: string;
  blurb: string;
}

export const ENGINEERING_FIELDS: EngineeringField[] = [
  { name: "Architectural Engineering", image: architectural, blurb: "Building design, structural integration, and construction systems." },
  { name: "Aerospace Engineering", image: aerospace, blurb: "Aircraft, avionics and flight systems." },
  { name: "Electrical Engineering", image: electrical, blurb: "Power generation, distribution and controls." },
  { name: "Civil Engineering", image: civil, blurb: "Roads, bridges and public infrastructure." },
  { name: "Mechanical Engineering", image: mechanical, blurb: "Machines, plant equipment and maintenance." },
  { name: "Computer Engineering", image: computer, blurb: "Hardware, embedded systems and networks." },
  { name: "Chemical Engineering", image: chemical, blurb: "Process plants and industrial chemistry." },
  { name: "Petroleum Engineering", image: petroleum, blurb: "Upstream, drilling and pipeline operations." },
  { name: "Software Engineering", image: software, blurb: "Applications, cloud platforms and data." },
  { name: "Industrial Engineering", image: industrial, blurb: "Production efficiency and quality systems." },
  { name: "Biomedical Engineering", image: biomedical, blurb: "Medical devices and hospital technology." },
  { name: "Environmental Engineering", image: environmental, blurb: "Water, waste and sustainability." },
  { name: "Structural Engineering", image: structural, blurb: "Steel, concrete and building integrity." },
  { name: "Marine Engineering", image: marine, blurb: "Vessels, ports and offshore systems." },
  { name: "Mining Engineering", image: mining, blurb: "Extraction, minerals and site safety." },
  { name: "Robotics Engineering", image: robotics, blurb: "Automation, control and smart machines." },
  { name: "Automotive Engineering", image: automotive, blurb: "Vehicles, engines and diagnostics." },
  { name: "Telecommunications Engineering", image: telecom, blurb: "Networks, towers and connectivity." },
  { name: "Agricultural Engineering", image: agricultural, blurb: "Farm machinery and irrigation systems." },
  { name: "Materials Engineering", image: materials, blurb: "Metals, polymers and composites." },
  { name: "Renewable Energy Engineering", image: renewable, blurb: "Solar, wind and clean power systems." },
];

export const ENGINEERING_FIELD_NAMES = ENGINEERING_FIELDS.map((f) => f.name);

/** Fallback deadline used before the live application period loads. */
export const APPLICATION_DEADLINE = new Date("2026-08-10T23:59:59+01:00");

export const EMPLOYMENT_LABELS: Record<string, string> = {
  pending: "Pending",
  employed: "Employed",
  not_qualified: "Not qualified",
};

export const PROGRAMME_FACTS = `WILLIE LAB TECH Empowerment Portal.
Sponsor and owner: Engr. Willie Effiong.
Purpose: empower young Nigerian engineers to fit into their field and find opportunities.
Target: 10,000 engineers across 20 engineering fields.
Application window: 29 July 2026 to 10 August 2026 (the admin can extend, close or reopen it).
Applicants register, complete a profile, upload qualification documents, and submit.
The admin reviews and accepts or rejects each application, and can also set an employment status of Pending, Employed or Not qualified.
Fields recruited: ${ENGINEERING_FIELD_NAMES.join(", ")}.`;
