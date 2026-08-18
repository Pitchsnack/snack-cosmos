import { useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  createSchedule,
  deleteSchedule,
  frequencyLabel,
  summariseCriteria,
} from "@/lib/ai-agents/agent-runtime";
import type { AgentSchedule, ExecutionMode, Frequency, SearchCriteria } from "@/lib/ai-agents/types";

export function ScheduleSection({
  criteria,
  schedules,
}: {
  criteria: SearchCriteria;
  schedules: AgentSchedule[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [execution, setExecution] = useState<ExecutionMode>("approval");

  const submit = () => {
    if (!startDate || !endDate) {
      toast.error("Start Date and End Date are both required.");
      return;
    }
    if (endDate < startDate) {
      toast.error("End Date must be after Start Date.");
      return;
    }
    createSchedule({ criteria, startDate, endDate, frequency, execution });
    toast.success("Schedule created for the Find Startups AI Agent.");
  };

  return (
    <section id="schedule" className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          2
        </span>
        <h2 className="text-xl font-semibold tracking-tight">Schedule</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose when and how this AI Agent should run. Every schedule requires a start and an end
        date — indefinite schedules are not supported.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="sch-start">Start Date</Label>
          <Input
            id="sch-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sch-end">End Date</Label>
          <Input
            id="sch-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Execution</Label>
          <RadioGroup
            value={execution}
            onValueChange={(v) => setExecution(v as ExecutionMode)}
            className="gap-1.5 pt-1"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="auto" /> Auto-run
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="approval" /> Require approval before each run
            </label>
          </RadioGroup>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={submit}>
          <CalendarClock className="mr-2 h-4 w-4" /> Schedule Agent
        </Button>
      </div>

      {schedules.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Frequency</th>
                <th className="px-3 py-2 font-medium">Start</th>
                <th className="px-3 py-2 font-medium">End</th>
                <th className="px-3 py-2 font-medium">Execution</th>
                <th className="px-3 py-2 font-medium">Criteria</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">{frequencyLabel(s.frequency)}</td>
                  <td className="px-3 py-2">{s.startDate}</td>
                  <td className="px-3 py-2">{s.endDate}</td>
                  <td className="px-3 py-2">
                    {s.execution === "auto" ? "Auto-run" : "Approval required"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {summariseCriteria(s.criteria).join(" · ")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => deleteSchedule(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
