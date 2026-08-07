// SOS & emergency configuration for the StudentHub prototype.
//
// SOS_RECIPIENTS: who an SOS alert is addressed to. For the prototype each
// recipient is a specific auth user (the "security" account). Replace `id`
// with the real auth.users id of your security/test account, then log in as
// that user to see incoming alerts on /sos. Nothing here is a secret.
//
// SOS_HOLD_SECONDS controls the hold-to-send duration on the SOS button.
// EMERGENCY_CONTACTS and SOS_PROCEDURES drive the static directory on /sos.

export type SosRecipient = {
  id: string;
  name: string;
  phone: string;
  icon: string;
  color: string;
};

export type EmergencyContact = {
  name: string;
  detail: string;
  phone: string;
  icon: string;
  color: string;
};

export type SosProcedure = {
  title: string;
  icon: string;
  steps: string[];
};

// Prototype recipient: fill `id` with the security user's auth.users id.
export const SOS_RECIPIENTS: SosRecipient[] = [
  {
    id: "cd66cc6c-ca50-4ede-9748-44ad81bef23b",
    name: "Campus Security",
    phone: "04-653 3333",
    icon: "ti-shield-check",
    color: "#5A4FCF",
  },
];

export const SOS_HOLD_SECONDS = 5;

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { name: "Campus Security", detail: "24 hours · on-campus response", phone: "04-653 3333", icon: "ti-shield-check", color: "#5A4FCF" },
  { name: "Health Centre", detail: "Mon–Fri · 8 AM – 5 PM", phone: "04-653 4444", icon: "ti-stethoscope", color: "#3DA35D" },
  { name: "Emergency Hotline", detail: "24 hours · police / fire / ambulance", phone: "999", icon: "ti-urgent", color: "#E24B4A" },
  { name: "Student Affairs Office", detail: "Mon–Fri · support & welfare", phone: "04-653 2222", icon: "ti-users", color: "#E0A92E" },
];

export const SOS_PROCEDURES: SosProcedure[] = [
  {
    title: "Threat or danger on campus",
    icon: "ti-shield-check",
    steps: [
      "Get to a safe place away from the source of danger.",
      "Send an SOS alert from the topbar button so security knows your location.",
      "Call Campus Security at 04-653 3333 and stay on the line.",
    ],
  },
  {
    title: "Medical emergency",
    icon: "ti-stethoscope",
    steps: [
      "Call 999 for an ambulance, then Campus Security at 04-653 3333.",
      "Send an SOS alert so responders know your exact location.",
      "Do not move the injured person unless they are in immediate danger.",
    ],
  },
  {
    title: "Fire",
    icon: "ti-flame",
    steps: [
      "Evacuate using the nearest fire exit. Do not use lifts.",
      "Call 994 (fire) or 999, then send an SOS alert from outside.",
      "Move to the assembly point and wait for the fire brigade.",
    ],
  },
];
