import { template as alertTemplate } from './alert'
import { confirmTemplate as contactConfirm, teamTemplate as contactTeam } from './contact'
import { softLaunchTemplate } from './soft-launch'
import { template as shareInvitation } from './share-invitation'
import { template as profileInvitation } from './profile-invitation'
import { template as buyOrderShare } from './buy-order-share'
import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  alert: alertTemplate,
  'contact-confirm': contactConfirm,
  'contact-team': contactTeam,
  'soft-launch': softLaunchTemplate,
  'share-invitation': shareInvitation,
  'profile-invitation': profileInvitation,
  'buy-order-share': buyOrderShare,
}
