/**
 * Company Info tab (ข้อมูลนิติบุคคล).
 *
 * Shows the Thai company record retrieved by the DBD Auto Enrich workflow and
 * lets an authorised user correct every field by hand. Manual edits never
 * remove the DBD provenance footer, and empty values stay empty — nothing is
 * translated or invented here.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCompanyInfoTh } from "@/lib/company-info.functions";
import { formatThaiDateTime, type CompanyInfoTh } from "@/lib/company-info";

const NAVY = "#122B54";
const EMPTY = "- ไม่มีข้อมูล -";

type Draft = CompanyInfoTh;

function CardShell({
  title,
  onEdit,
  editing,
  children,
}: {
  title: string;
  onEdit?: () => void;
  editing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-[#E1E6EF] bg-white">
      <header
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: NAVY }}
      >
        <h3 className="text-[14.5px] font-semibold text-white">{title}</h3>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-[7px] bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-white/20"
          >
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "ยกเลิก" : "แก้ไข"}
          </button>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-start gap-3 border-b border-[#EEF1F6] py-2 last:border-b-0">
      <div className="text-[12.5px] font-medium text-[#5A6579]">{label}</div>
      <div className="min-w-0 text-[12.5px] text-[#0F1B33]">{children}</div>
    </div>
  );
}

const show = (v: string | null | undefined) =>
  v && v.trim() ? <span className="whitespace-pre-line">{v}</span> : <span className="text-[#9AA3B2]">-</span>;

export function CompanyInfoTab({
  startupId,
  info,
  canManage,
  onSaved,
}: {
  startupId: string;
  info: CompanyInfoTh;
  canManage: boolean;
  onSaved: () => void;
}) {
  const save = useServerFn(saveCompanyInfoTh);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(info);

  useEffect(() => {
    if (!editing) setDraft(info);
  }, [info, editing]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          startupId,
          info: {
            legalNameTh: draft.legalNameTh,
            registrationNumber: draft.registrationNumber,
            legalEntityTypeTh: draft.legalEntityTypeTh,
            legalEntityStatusTh: draft.legalEntityStatusTh,
            registrationDateThRaw: draft.registrationDateThRaw,
            registeredCapitalThRaw: draft.registeredCapitalThRaw,
            previousRegistrationNumber: draft.previousRegistrationNumber,
            businessGroupTh: draft.businessGroupTh,
            businessSize: draft.businessSize,
            headOfficeAddressTh: draft.headOfficeAddressTh,
            website: draft.website,
            authorizedSignatoryTh: draft.authorizedSignatoryTh,
            submissionYearsBe: draft.submissionYearsBe,
            directors: draft.directors
              .filter((d) => d.nameTh.trim())
              .map((d) => ({ nameTh: d.nameTh.trim() })),
            registeredBusiness: draft.registeredBusiness,
            latestBusiness: draft.latestBusiness,
          },
        },
      }),
    onSuccess: () => {
      toast.success("บันทึกข้อมูลนิติบุคคลแล้ว");
      setEditing(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const provenance = useMemo(() => {
    const retrieved = formatThaiDateTime(info.retrievedAt);
    return `แหล่งข้อมูล: ${info.sourceName ?? "DBD Data Warehouse"}${
      retrieved ? ` · ดึงข้อมูลล่าสุด: ${retrieved}` : ""
    }`;
  }, [info.retrievedAt, info.sourceName]);

  const toggleEdit = canManage ? () => setEditing((v) => !v) : undefined;

  const textField = (key: keyof Draft, placeholder?: string) => (
    <Input
      value={(draft[key] as string | null) ?? ""}
      placeholder={placeholder}
      onChange={(e) => set(key, (e.target.value || null) as Draft[typeof key])}
      className="h-8 text-[12.5px]"
    />
  );

  return (
    <div className="space-y-4">
      {editing && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditing(false); setDraft(info); }}>
            ยกเลิก
          </Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left — ข้อมูลนิติบุคคล */}
        <CardShell title="ข้อมูลนิติบุคคล" onEdit={toggleEdit} editing={editing}>
          {editing ? (
            <div className="space-y-2.5">
              <Row label="ชื่อนิติบุคคล">{textField("legalNameTh")}</Row>
              <Row label="เลขทะเบียนนิติบุคคล">{textField("registrationNumber")}</Row>
              <Row label="ประเภทนิติบุคคล">{textField("legalEntityTypeTh")}</Row>
              <Row label="สถานะนิติบุคคล">{textField("legalEntityStatusTh")}</Row>
              <Row label="วันที่จดทะเบียนจัดตั้ง">{textField("registrationDateThRaw", "30 พ.ค. 2555")}</Row>
              <Row label="ทุนจดทะเบียน">{textField("registeredCapitalThRaw")}</Row>
              <Row label="เลขทะเบียนเดิม">{textField("previousRegistrationNumber")}</Row>
              <Row label="กลุ่มธุรกิจ">{textField("businessGroupTh")}</Row>
              <Row label="ขนาดธุรกิจ">{textField("businessSize")}</Row>
              <Row label="ปีที่ส่งงบการเงิน">
                <Input
                  value={draft.submissionYearsBe.join(", ")}
                  placeholder="2568, 2567, 2566"
                  onChange={(e) =>
                    set(
                      "submissionYearsBe",
                      e.target.value
                        .split(/[^0-9]+/)
                        .map(Number)
                        .filter((n) => n >= 2400 && n <= 2699),
                    )
                  }
                  className="h-8 text-[12.5px]"
                />
              </Row>
              <Row label="ที่ตั้งสำนักงานใหญ่">
                <Textarea
                  value={draft.headOfficeAddressTh ?? ""}
                  onChange={(e) => set("headOfficeAddressTh", e.target.value || null)}
                  className="min-h-[70px] text-[12.5px]"
                />
              </Row>
              <Row label="Website">{textField("website")}</Row>
            </div>
          ) : (
            <div>
              <Row label="ชื่อนิติบุคคล">{show(info.legalNameTh)}</Row>
              <Row label="เลขทะเบียนนิติบุคคล">{show(info.registrationNumber)}</Row>
              <Row label="ประเภทนิติบุคคล">{show(info.legalEntityTypeTh)}</Row>
              <Row label="สถานะนิติบุคคล">
                {info.legalEntityStatusTh ? (
                  <span
                    className="font-semibold"
                    style={{
                      color: info.legalEntityStatusTh.includes("ยังดำเนินกิจการอยู่")
                        ? "#16A34A"
                        : "#0F1B33",
                    }}
                  >
                    {info.legalEntityStatusTh}
                  </span>
                ) : (
                  show(null)
                )}
              </Row>
              <Row label="วันที่จดทะเบียนจัดตั้ง">{show(info.registrationDateThRaw)}</Row>
              <Row label="ทุนจดทะเบียน">{show(info.registeredCapitalThRaw)}</Row>
              <Row label="เลขทะเบียนเดิม">{show(info.previousRegistrationNumber)}</Row>
              <Row label="กลุ่มธุรกิจ">{show(info.businessGroupTh)}</Row>
              <Row label="ขนาดธุรกิจ">{show(info.businessSize)}</Row>
              <Row label="ปีที่ส่งงบการเงิน">
                {info.submissionYearsBe.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {info.submissionYearsBe.map((y) => (
                      <span
                        key={y}
                        className="rounded-[6px] border border-[#CBD9F2] bg-[#EEF4FE] px-2 py-0.5 text-[12px] font-semibold text-[#2563EB]"
                      >
                        {y}
                      </span>
                    ))}
                  </div>
                ) : (
                  show(null)
                )}
              </Row>
              <Row label="ที่ตั้งสำนักงานใหญ่">{show(info.headOfficeAddressTh)}</Row>
              <Row label="Website">
                {info.website ? (
                  <a
                    href={/^https?:/i.test(info.website) ? info.website : `https://${info.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1E3A8A] hover:underline"
                  >
                    {info.website}
                  </a>
                ) : (
                  show(null)
                )}
              </Row>
            </div>
          )}
        </CardShell>

        {/* Middle — รายชื่อกรรมการ */}
        <CardShell title="รายชื่อกรรมการ" onEdit={toggleEdit} editing={editing}>
          {editing ? (
            <div className="space-y-2">
              {draft.directors.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-6 text-center text-[12px] text-[#5A6579]">{i + 1}</span>
                  <Input
                    value={d.nameTh}
                    onChange={(e) =>
                      setDraft((prev) => {
                        const next = [...prev.directors];
                        next[i] = { ...next[i], nameTh: e.target.value };
                        return { ...prev, directors: next };
                      })
                    }
                    className="h-8 text-[12.5px]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === 0}
                    onClick={() =>
                      setDraft((prev) => {
                        const next = [...prev.directors];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return { ...prev, directors: next };
                      })
                    }
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === draft.directors.length - 1}
                    onClick={() =>
                      setDraft((prev) => {
                        const next = [...prev.directors];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        return { ...prev, directors: next };
                      })
                    }
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        directors: prev.directors.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    directors: [
                      ...prev.directors,
                      { displayOrder: prev.directors.length + 1, nameTh: "" },
                    ],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> เพิ่มกรรมการ
              </Button>
            </div>
          ) : info.directors.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-[#9AA3B2]">{EMPTY}</p>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F3F6FC] text-left text-[#0F1B33]">
                  <th className="w-16 border border-[#E1E6EF] px-3 py-2 font-semibold">ลำดับ</th>
                  <th className="border border-[#E1E6EF] px-3 py-2 font-semibold">ชื่อกรรมการ</th>
                </tr>
              </thead>
              <tbody>
                {info.directors.map((d, i) => (
                  <tr key={d.id ?? i}>
                    <td className="border border-[#E1E6EF] px-3 py-2 text-[#5A6579]">{i + 1}</td>
                    <td className="border border-[#E1E6EF] px-3 py-2 text-[#0F1B33]">{d.nameTh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardShell>

        {/* Right — three stacked cards */}
        <div className="space-y-4">
          <CardShell title="กรรมการลงชื่อผูกพัน" onEdit={toggleEdit} editing={editing}>
            {editing ? (
              <Textarea
                value={draft.authorizedSignatoryTh ?? ""}
                onChange={(e) => set("authorizedSignatoryTh", e.target.value || null)}
                className="min-h-[70px] text-[12.5px]"
              />
            ) : info.authorizedSignatoryTh ? (
              <p className="whitespace-pre-line text-[12.5px] text-[#0F1B33]">
                {info.authorizedSignatoryTh}
              </p>
            ) : (
              <p className="py-3 text-center text-[12.5px] text-[#9AA3B2]">{EMPTY}</p>
            )}
          </CardShell>

          <CardShell title="ประเภทธุรกิจตอนจดทะเบียน" onEdit={toggleEdit} editing={editing}>
            {editing ? (
              <div className="space-y-2.5">
                <Row label="ประเภทธุรกิจ">
                  <Textarea
                    value={draft.registeredBusiness.descriptionTh ?? ""}
                    onChange={(e) =>
                      set("registeredBusiness", {
                        ...draft.registeredBusiness,
                        descriptionTh: e.target.value || null,
                      })
                    }
                    className="min-h-[60px] text-[12.5px]"
                  />
                </Row>
                <Row label="วัตถุประสงค์">
                  <Textarea
                    value={draft.registeredBusiness.objectiveTh ?? ""}
                    onChange={(e) =>
                      set("registeredBusiness", {
                        ...draft.registeredBusiness,
                        objectiveTh: e.target.value || null,
                      })
                    }
                    className="min-h-[60px] text-[12.5px]"
                  />
                </Row>
              </div>
            ) : (
              <div>
                <Row label="ประเภทธุรกิจ">
                  {show(
                    [info.registeredBusiness.code, info.registeredBusiness.descriptionTh]
                      .filter(Boolean)
                      .join(" ") || null,
                  )}
                </Row>
                <Row label="วัตถุประสงค์">{show(info.registeredBusiness.objectiveTh)}</Row>
              </div>
            )}
          </CardShell>

          <CardShell title="ประเภทธุรกิจที่ส่งงบการเงินปีล่าสุด" onEdit={toggleEdit} editing={editing}>
            {editing ? (
              <div className="space-y-2.5">
                <Row label="ประเภทธุรกิจ">
                  <Textarea
                    value={draft.latestBusiness.descriptionTh ?? ""}
                    onChange={(e) =>
                      set("latestBusiness", {
                        ...draft.latestBusiness,
                        descriptionTh: e.target.value || null,
                      })
                    }
                    className="min-h-[60px] text-[12.5px]"
                  />
                </Row>
                <Row label="วัตถุประสงค์">
                  <Textarea
                    value={draft.latestBusiness.objectiveTh ?? ""}
                    onChange={(e) =>
                      set("latestBusiness", {
                        ...draft.latestBusiness,
                        objectiveTh: e.target.value || null,
                      })
                    }
                    className="min-h-[60px] text-[12.5px]"
                  />
                </Row>
              </div>
            ) : (
              <div>
                <Row label="ประเภทธุรกิจ">
                  {show(
                    [info.latestBusiness.code, info.latestBusiness.descriptionTh]
                      .filter(Boolean)
                      .join(" ") || null,
                  )}
                </Row>
                <Row label="วัตถุประสงค์">{show(info.latestBusiness.objectiveTh)}</Row>
              </div>
            )}
          </CardShell>
        </div>
      </div>

      <p className="text-[11.5px] text-[#7A8496]">
        {provenance}
        {info.manuallyEditedAt && (
          <span> · แก้ไขล่าสุดโดยผู้ใช้: {formatThaiDateTime(info.manuallyEditedAt)}</span>
        )}
      </p>
    </div>
  );
}
