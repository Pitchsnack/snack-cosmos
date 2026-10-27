/**
 * Quick Add Contact — adapter boundary.
 *
 * UI-only. Extraction, duplicate detection, and save are routed through this
 * adapter so the page component stays free of vendor coupling. A future
 * backend can replace `mockAdapter` without touching the page.
 */

export interface ExtractedContact {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  companyType?: string;
  industry?: string[];
  companyWebsite?: string;
  companyLinkedin?: string;
  companyAddress?: string;
  country?: string;
  city?: string;
  workEmail?: string;
  altEmail?: string;
  mobile?: string;
  office?: string;
  extension?: string;
  personalLinkedin?: string;
  otherSocial?: string;
  contactType?: "Personal Contact" | "PitchSnack Contact";
  relationship?: string;
  tags?: string[];
  notes?: string;
}

export type FieldConfidence = "high" | "review" | "missing";

export interface ExtractionResult {
  data: ExtractedContact;
  confidence: Partial<Record<keyof ExtractedContact, FieldConfidence>>;
}

export type ScanStage =
  | "detect_name_company"
  | "read_phone_email"
  | "identify_website_social"
  | "read_address"
  | "finalise";

export interface ScanProgressEvent {
  stage: ScanStage;
  status: "pending" | "in_progress" | "done" | "review";
  partial?: Partial<ExtractedContact>;
  partialConfidence?: Partial<Record<keyof ExtractedContact, FieldConfidence>>;
}

export interface DuplicateMatch {
  id: string;
  name: string;
  jobTitle?: string;
  company?: string;
  email?: string;
  phone?: string;
}

export interface QuickAddAdapter {
  extractFromCard(input: {
    frontFile: File;
    backFile: File | null;
    onProgress: (e: ScanProgressEvent) => void;
    signal?: AbortSignal;
  }): Promise<ExtractionResult>;
  findDuplicates(candidate: ExtractedContact): Promise<DuplicateMatch[]>;
  saveContact(input: {
    contact: ExtractedContact;
    event?: string;
    keepImages: boolean;
    frontFile: File | null;
    backFile: File | null;
  }): Promise<{ id: string }>;
}

/* ------------------------------- Mock impl -------------------------------- */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mockAdapter: QuickAddAdapter = {
  async extractFromCard({ onProgress, signal }) {
    const data: ExtractedContact = {};
    const conf: ExtractionResult["confidence"] = {};

    const step = async (
      stage: ScanStage,
      patch: Partial<ExtractedContact>,
      patchConf: Partial<Record<keyof ExtractedContact, FieldConfidence>>,
      ms: number,
      status: "done" | "review" = "done",
    ) => {
      onProgress({ stage, status: "in_progress" });
      await delay(ms);
      if (signal?.aborted) throw new Error("aborted");
      Object.assign(data, patch);
      Object.assign(conf, patchConf);
      onProgress({ stage, status, partial: patch, partialConfidence: patchConf });
    };

    await step(
      "detect_name_company",
      {
        firstName: "Andrew",
        lastName: "Chen",
        fullName: "Andrew Chen",
        jobTitle: "CEO & Co-Founder",
        companyName: "Nana Technologies",
      },
      { firstName: "high", lastName: "high", fullName: "high", jobTitle: "high", companyName: "high" },
      700,
    );
    await step(
      "read_phone_email",
      { workEmail: "andrew.chen@nana.tech", mobile: "+65 9123 4567" },
      { workEmail: "high", mobile: "high" },
      650,
    );
    await step(
      "identify_website_social",
      { companyWebsite: "www.nana.tech", personalLinkedin: "linkedin.com/in/andrewchen" },
      { companyWebsite: "high", personalLinkedin: "review" },
      600,
      "review",
    );
    await step(
      "read_address",
      { country: "Singapore", city: "Singapore", industry: ["SaaS", "AI / ML"] },
      { country: "review", city: "review", industry: "high" },
      550,
      "review",
    );
    await step(
      "finalise",
      { contactType: "Personal Contact", relationship: "Startup" },
      { contactType: "high", relationship: "review" },
      400,
    );

    return { data, confidence: conf };
  },

  async findDuplicates(candidate) {
    // Deterministic small mock — trigger a duplicate when email matches seed.
    await delay(300);
    if (
      candidate.workEmail?.toLowerCase() === "andrew.chen@nana.tech" ||
      candidate.fullName?.toLowerCase() === "andrew chen"
    ) {
      return [
        {
          id: "existing-1",
          name: "Andrew Chen",
          jobTitle: "CEO & Co-Founder",
          company: "Nana Technologies",
          email: "andrew.chen@nana.tech",
          phone: "+65 9123 4567",
        },
      ];
    }
    return [];
  },

  async saveContact() {
    await delay(400);
    return { id: `local-${Date.now()}` };
  },
};

export const quickAddAdapter: QuickAddAdapter = mockAdapter;

export const SCAN_STAGES: { key: ScanStage; label: string }[] = [
  { key: "detect_name_company", label: "Detecting name & company" },
  { key: "read_phone_email", label: "Reading phone & email" },
  { key: "identify_website_social", label: "Identifying website & social links" },
  { key: "read_address", label: "Reading address & other info" },
  { key: "finalise", label: "Finalising data" },
];
