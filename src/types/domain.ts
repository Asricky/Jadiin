export type Status =
  'DRAFT' | 'STAGE_1_OPEN' | 'STAGE_1_CLOSED' | 'STAGE_2_OPEN' | 'COMPLETED' | 'ARCHIVED';
export interface Event {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  status: Status;
  cover_path: string | null;
  stage1_deadline: string | null;
  stage2_deadline: string | null;
  final_villa_id: string | null;
  final_date: string | null;
  final_end_date: string | null;
  cost_per_person: number | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  payment_note: string | null;
  show_transport_groups: boolean;
  show_participant_list: boolean;
  created_at: string;
}
export interface EventDate {
  id: string;
  event_id: string;
  date: string;
}
export interface Villa {
  id: string;
  event_id: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  address: string;
  google_maps_url: string;
  facilities: string[];
  notes: string;
  cover_path: string | null;
  active: boolean;
  sort_order: number;
}
export interface VillaImage {
  id: string;
  villa_id: string;
  storage_path: string;
}
export interface Participant {
  id: string;
  event_id: string;
  name: string;
  whatsapp: string;
  vehicle_type: 'CAR' | 'MOTORCYCLE' | 'NONE';
  vehicle_owner: string | null;
  vehicle_driver: string | null;
  vehicle_capacity: number | null;
  stage1_submitted_at: string;
  stage2_submitted_at: string | null;
}
export interface Availability {
  participant_id: string;
  event_date_id: string;
}
export interface Vote {
  participant_id: string;
  villa_id: string;
}
export interface Group {
  id: string;
  type: 'CAR' | 'MOTORCYCLE' | 'INDEPENDENT';
  label: string;
  capacity: number;
  owner_participant_id: string | null;
  driver_participant_id: string | null;
}
export interface Member {
  participant_id: string;
  transport_group_id: string;
  role: 'DRIVER' | 'PASSENGER';
}
export interface Payment {
  id: string;
  participant_id: string;
  amount: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  admin_note: string | null;
  submitted_at: string;
}
export interface Bundle {
  event: Event;
  dates: EventDate[];
  villas: Villa[];
  images: VillaImage[];
  participants: Participant[];
  availability: Availability[];
  votes: Vote[];
  groups: Group[];
  members: Member[];
  payments: Payment[];
}
export const statusLabel: Record<Status, string> = {
  DRAFT: 'Draft',
  STAGE_1_OPEN: 'Voting dibuka',
  STAGE_1_CLOSED: 'Sedang difinalisasi',
  STAGE_2_OPEN: 'Siap berangkat',
  COMPLETED: 'Selesai',
  ARCHIVED: 'Diarsipkan',
};
