# Database Resource Plan

## Technician Profiles
- id
- user_id
- phone
- skills
- preferred_locations
- minimum_hours_per_week
- can_travel
- active_status

## Preferred Time Blocks
- id
- technician_id
- semester
- day_of_week
- start_time
- end_time
- preference_type

## Call-Offs
- id
- technician_id
- date
- shift_id
- reason
- excused_status
- reported_at

## Programs
- id
- name
- required_skills
- description

## Assignments
- id
- shift_id
- technician_id
- status
- assigned_by
- created_at
