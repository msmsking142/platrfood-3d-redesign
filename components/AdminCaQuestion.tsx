import { useEffect, useRef, useState } from "react";
import { caQuestions } from "../helpers/caQuestions";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import styles from "./AdminCaQuestion.module.css";

type Question = (typeof caQuestions.questions)[number];

type Props = {
  question: Question;
  savedAnswer: string;
  updatedAt: Date | null;
  onSave: (questionNo: number, answer: string) => void;
  isPending: boolean;
  className?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const AdminCaQuestion = ({
  question,
  savedAnswer,
  updatedAt,
  onSave,
  isPending,
  className,
}: Props) => {
  const [draft, setDraft] = useState(savedAnswer);
  const previousSavedAnswer = useRef(savedAnswer);

  useEffect(() => {
    const previous = previousSavedAnswer.current;
    setDraft((current) => (current === previous ? savedAnswer : current));
    previousSavedAnswer.current = savedAnswer;
  }, [savedAnswer]);

  return (
    <article className={`${styles.root} ${className ?? ""}`}>
      <div className={styles.questionHeader}>
        <span className={styles.number} aria-hidden="true">
          {question.no}
        </span>
        <div className={styles.questionContent}>
          <h3 id={`ca-question-${question.no}`}>{question.title}</h3>
          <p>{question.text}</p>
        </div>
      </div>

      <label className={styles.answerLabel} htmlFor={`ca-answer-${question.no}`}>
        CA answer
      </label>
      <Textarea
        id={`ca-answer-${question.no}`}
        aria-describedby={`ca-question-${question.no}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Enter the CA’s answer"
        rows={3}
        disabled={isPending}
        className={styles.answer}
      />

      <div className={styles.actions}>
        <span className={styles.savedAt} aria-live="polite">
          {updatedAt
            ? `Last saved ${dateFormatter.format(updatedAt)}`
            : "Not answered yet"}
        </span>
        <Button
          type="button"
          size="sm"
          disabled={isPending || draft === savedAnswer}
          onClick={() => onSave(question.no, draft)}
          aria-label={`Save answer to question ${question.no}`}
        >
          Save
        </Button>
      </div>
    </article>
  );
};