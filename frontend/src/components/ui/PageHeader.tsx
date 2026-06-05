interface PageHeaderProps {
  title:    string
  subtitle?: string
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="pb-5 mb-6 border-b border-border animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
      {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
    </div>
  )
}
