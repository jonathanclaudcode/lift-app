interface QuestionHeaderProps {
  questionNumber: number
  totalQuestions: number
  title: string
  subtitle?: string
}

export function QuestionHeader({
  questionNumber,
  totalQuestions,
  title,
  subtitle,
}: QuestionHeaderProps) {
  return (
    <>
      <p className="text-xs text-muted-foreground mb-6">
        Fråga {questionNumber} av {totalQuestions}
      </p>
      <h2 className="text-xl font-medium leading-snug mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>}
    </>
  )
}
