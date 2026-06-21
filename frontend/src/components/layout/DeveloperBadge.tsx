import { useState, useEffect, useRef } from 'react'
import { Phone, Mail, Linkedin, Globe, Briefcase, ChevronDown, BadgeCheck } from 'lucide-react'

// Top-right "open to work" badge that expands into a contact card.
const CONTACT = {
  name: 'Sushant Garg',
  tagline: 'Full-Stack & Data/AI Engineer · Builder of Triax',
  phoneDisplay: '+91 90878 60807',
  phone: 'tel:+919087860807',
  email: 'sgargandcompany@gmail.com',
  linkedin: 'https://www.linkedin.com/in/garg-sushant/',
  portfolio: 'https://sushantgarg.netlify.app',
}

export default function DeveloperBadge() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-full border border-border bg-bg-card hover:bg-bg-elevated transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-[0.65rem] font-bold text-accent-blue">SG</span>
        <span className="text-xs text-text-secondary hidden sm:block">{CONTACT.name}</span>
        <span className="flex items-center gap-1.5 text-[0.65rem] font-medium text-accent-green">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-slow" />
          Open to work
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-bg-card shadow-card z-50 overflow-hidden animate-fade-in">
          <div className="p-4 bg-gradient-to-br from-accent-blue/10 to-accent-purple/10 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-sm font-bold text-accent-blue">SG</span>
              <div>
                <p className="text-sm font-bold text-text-primary">{CONTACT.name}</p>
                <p className="text-[0.7rem] text-text-secondary">{CONTACT.tagline}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-accent-green font-medium">
              <BadgeCheck className="w-3.5 h-3.5" />
              Open to Contract &amp; Full-time opportunities
            </div>
          </div>

          <div className="p-2">
            <ContactRow icon={Phone} label={CONTACT.phoneDisplay} href={CONTACT.phone} />
            <ContactRow icon={Mail} label={CONTACT.email} href={`mailto:${CONTACT.email}`} />
            <ContactRow icon={Linkedin} label="linkedin.com/in/garg-sushant" href={CONTACT.linkedin} external />
            <ContactRow icon={Globe} label="sushantgarg.netlify.app" href={CONTACT.portfolio} external />
          </div>

          <a
            href={`mailto:${CONTACT.email}?subject=Opportunity for Sushant Garg`}
            className="block m-2 mt-0 text-center btn-primary text-xs py-2"
          >
            <Briefcase className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Hire / Contact Me
          </a>
        </div>
      )}
    </div>
  )
}

function ContactRow({ icon: Icon, label, href, external }: any) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
    >
      <span className="w-7 h-7 rounded-md bg-bg-elevated flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-accent-blue" />
      </span>
      <span className="truncate">{label}</span>
    </a>
  )
}
