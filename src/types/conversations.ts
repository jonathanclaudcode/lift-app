export interface ConversationCustomer {
  id: string
  name: string
  phone: string | null
  pipeline_stage: string
}

export interface ConversationListItem {
  id: string
  channel: string
  status: string
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  customer_id: string
  customers: ConversationCustomer
}

export interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  author: 'customer' | 'ai_agent' | 'clinic_staff'
  content: string
  status: string
  channel: string
  created_at: string
  ai_suggestions: any | null
  suggested_text: string | null
  final_text: string | null
}
