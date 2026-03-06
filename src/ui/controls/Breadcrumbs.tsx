import type { BreadcrumbItem } from '@/graph/compile/toReactFlow'

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Selection breadcrumb">
      {items.map((item, index) => (
        <span key={item.id}>
          <span>{item.label}</span>
          {index < items.length - 1 ? <span className="breadcrumbs__divider">/</span> : null}
        </span>
      ))}
    </nav>
  )
}

