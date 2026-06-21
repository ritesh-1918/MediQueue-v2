import twilio from 'twilio'

export interface WhatsAppParams {
  phone: string
  patientName: string
  tokenNumber: string
  doctorName: string
  estimatedWait: number
  queuePosition: number
}

export interface WhatsAppResult {
  success: boolean
  messageSid?: string
  error?: string
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`
  return `+${digits}`
}

export async function sendTokenWhatsApp(params: WhatsAppParams): Promise<WhatsAppResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!sid || !token || sid.length < 10) {
    return { success: false, error: 'Twilio not configured' }
  }

  try {
    const client = twilio(sid, token)
    const toPhone = formatPhone(params.phone)

    const body = `🏥 *MediQueue Token Confirmation*

Hello ${params.patientName}! Your token has been booked.

🎫 Token: *${params.tokenNumber}*
👨‍⚕️ Doctor: ${params.doctorName}
📍 Position: #${params.queuePosition} in queue
⏱ Estimated wait: ~${params.estimatedWait} minutes

Please arrive 5 minutes before your estimated time.

_MediQueue — Smart Clinic Management_`

    const message = await client.messages.create({
      from,
      to: `whatsapp:${toPhone}`,
      body,
    })

    console.log(`[WhatsApp] Sent to ${toPhone} — SID: ${message.sid}`)
    return { success: true, messageSid: message.sid }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[WhatsApp] Failed:`, error)
    return { success: false, error }
  }
}
