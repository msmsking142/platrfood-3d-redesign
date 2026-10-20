import { ClipboardList, Copy } from "lucide-react";
import type { Selectable } from "kysely";
import { toast } from "sonner";
import type { CaAnswers } from "../helpers/schema";
import { caQuestions } from "../helpers/caQuestions";
import { AdminCaQuestion } from "./AdminCaQuestion";
import { Button } from "./Button";
import styles from "./AdminCaChecklist.module.css";

type SavedAnswer = Pick<
  Selectable<CaAnswers>,
  "questionNo" | "answer" | "updatedAt"
>;

type Props = {
  answers: SavedAnswer[];
  onSave: (questionNo: number, answer: string) => void;
  isPending: boolean;
  className?: string;
};

export const AdminCaChecklist = ({
  answers,
  onSave,
  isPending,
  className,
}: Props) => {
  const savedAnswers = new Map(
    answers.map(({ questionNo, answer }) => [questionNo, answer]),
  );
  const answeredCount = caQuestions.questions.filter(
    ({ no }) => (savedAnswers.get(no) ?? "").trim().length > 0,
  ).length;

  const copyQuestions = async () => {
    try {
      await navigator.clipboard.writeText(
        caQuestions.buildCopyText(Object.fromEntries(savedAnswers)),
      );
      toast.success("CA questions copied to clipboard.");
    } catch (error) {
      console.error("Could not copy CA questions:", error);
      toast.error("Could not copy the questions. Check clipboard permissions.");
    }
  };

  return (
    <section
      id="ca-questions"
      className={`${styles.root} ${className ?? ""}`}
      aria-labelledby="ca-questions-heading"
    >
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <div className={styles.headingRow}>
            <ClipboardList aria-hidden="true" size={26} />
            <h2 id="ca-questions-heading">CA questions</h2>
          </div>
          <p>
            Keep your CA’s answers together before updating platr™’s tax
            settings.
          </p>
        </div>
        <span className={styles.progress}>
          {answeredCount} of {caQuestions.questions.length} answered
        </span>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => void copyQuestions()}
        className={styles.copyButton}
      >
        <Copy aria-hidden="true" size={18} />
        Copy all questions
      </Button>

      <div className={styles.questionList}>
        {caQuestions.questions.map((question) => {
          const saved = answers.find(
            (answer) => answer.questionNo === question.no,
          );

          return (
            <AdminCaQuestion
              key={question.no}
              question={question}
              savedAnswer={saved?.answer ?? ""}
              updatedAt={saved?.updatedAt ?? null}
              onSave={onSave}
              isPending={isPending}
            />
          );
        })}
      </div>

      <p className={styles.footer}>
        When all answers are filled, ask Floot AI to update the app to match.
        These answers don't change any tax settings by themselves.
      </p>
    </section>
  );
};