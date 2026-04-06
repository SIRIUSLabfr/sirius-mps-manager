export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      calculation_templates: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calculation_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calculations: {
        Row: {
          config_json: Json | null
          created_at: string
          finance_type: string | null
          id: string
          is_active: boolean | null
          label: string | null
          leasing_factor: number | null
          margin_total: number | null
          old_net_value: number | null
          old_rate: number | null
          old_remaining_months: number | null
          project_id: string
          service_rate: number | null
          term_months: number | null
          total_hardware_ek: number | null
          total_monthly_rate: number | null
          updated_at: string
        }
        Insert: {
          config_json?: Json | null
          created_at?: string
          finance_type?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          leasing_factor?: number | null
          margin_total?: number | null
          old_net_value?: number | null
          old_rate?: number | null
          old_remaining_months?: number | null
          project_id: string
          service_rate?: number | null
          term_months?: number | null
          total_hardware_ek?: number | null
          total_monthly_rate?: number | null
          updated_at?: string
        }
        Update: {
          config_json?: Json | null
          created_at?: string
          finance_type?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          leasing_factor?: number | null
          margin_total?: number | null
          old_net_value?: number | null
          old_rate?: number | null
          old_remaining_months?: number | null
          project_id?: string
          service_rate?: number | null
          term_months?: number | null
          total_hardware_ek?: number | null
          total_monthly_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          checklist_type: string
          created_at: string
          id: string
          items: Json | null
          notes: string | null
          participants: string | null
          project_id: string
          updated_at: string
          walkthrough_date: string | null
        }
        Insert: {
          checklist_type: string
          created_at?: string
          id?: string
          items?: Json | null
          notes?: string | null
          participants?: string | null
          project_id: string
          updated_at?: string
          walkthrough_date?: string | null
        }
        Update: {
          checklist_type?: string
          created_at?: string
          id?: string
          items?: Json | null
          notes?: string | null
          participants?: string | null
          project_id?: string
          updated_at?: string
          walkthrough_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          config_json: Json | null
          created_at: string
          id: string
          project_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          config_json?: Json | null
          created_at?: string
          id?: string
          project_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          config_json?: Json | null
          created_at?: string
          id?: string
          project_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concepts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      device_placements: {
        Row: {
          created_at: string | null
          device_id: string
          floor_plan_id: string
          id: string
          label: string | null
          updated_at: string | null
          x_percent: number
          y_percent: number
        }
        Insert: {
          created_at?: string | null
          device_id: string
          floor_plan_id: string
          id?: string
          label?: string | null
          updated_at?: string | null
          x_percent: number
          y_percent: number
        }
        Update: {
          created_at?: string | null
          device_id?: string
          floor_plan_id?: string
          id?: string
          label?: string | null
          updated_at?: string | null
          x_percent?: number
          y_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "device_placements_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_placements_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          customer_device_number: string | null
          delivery_date: string | null
          device_number: number | null
          final_check: string | null
          final_check_notes: string | null
          gegebenheiten: string | null
          id: string
          ist_building: string | null
          ist_floor: string | null
          ist_inventory_number: string | null
          ist_ip: string | null
          ist_manufacturer: string | null
          ist_model: string | null
          ist_pickup: boolean | null
          ist_room: string | null
          ist_serial: string | null
          ist_source: string | null
          location_id: string | null
          mapped_to_device_id: string | null
          notes: string | null
          optimization_type: string | null
          preparation_notes: string | null
          preparation_status: string
          prepared_by: string | null
          project_id: string
          rollout_day: number | null
          soll_accessories: string | null
          soll_building: string | null
          soll_device_id: string | null
          soll_floor: string | null
          soll_manufacturer: string | null
          soll_model: string | null
          soll_options: string | null
          soll_room: string | null
          soll_serial: string | null
          updated_at: string
          zoho_product_id: string | null
        }
        Insert: {
          created_at?: string
          customer_device_number?: string | null
          delivery_date?: string | null
          device_number?: number | null
          final_check?: string | null
          final_check_notes?: string | null
          gegebenheiten?: string | null
          id?: string
          ist_building?: string | null
          ist_floor?: string | null
          ist_inventory_number?: string | null
          ist_ip?: string | null
          ist_manufacturer?: string | null
          ist_model?: string | null
          ist_pickup?: boolean | null
          ist_room?: string | null
          ist_serial?: string | null
          ist_source?: string | null
          location_id?: string | null
          mapped_to_device_id?: string | null
          notes?: string | null
          optimization_type?: string | null
          preparation_notes?: string | null
          preparation_status?: string
          prepared_by?: string | null
          project_id: string
          rollout_day?: number | null
          soll_accessories?: string | null
          soll_building?: string | null
          soll_device_id?: string | null
          soll_floor?: string | null
          soll_manufacturer?: string | null
          soll_model?: string | null
          soll_options?: string | null
          soll_room?: string | null
          soll_serial?: string | null
          updated_at?: string
          zoho_product_id?: string | null
        }
        Update: {
          created_at?: string
          customer_device_number?: string | null
          delivery_date?: string | null
          device_number?: number | null
          final_check?: string | null
          final_check_notes?: string | null
          gegebenheiten?: string | null
          id?: string
          ist_building?: string | null
          ist_floor?: string | null
          ist_inventory_number?: string | null
          ist_ip?: string | null
          ist_manufacturer?: string | null
          ist_model?: string | null
          ist_pickup?: boolean | null
          ist_room?: string | null
          ist_serial?: string | null
          ist_source?: string | null
          location_id?: string | null
          mapped_to_device_id?: string | null
          notes?: string | null
          optimization_type?: string | null
          preparation_notes?: string | null
          preparation_status?: string
          prepared_by?: string | null
          project_id?: string
          rollout_day?: number | null
          soll_accessories?: string | null
          soll_building?: string | null
          soll_device_id?: string | null
          soll_floor?: string | null
          soll_manufacturer?: string | null
          soll_model?: string | null
          soll_options?: string | null
          soll_room?: string | null
          soll_serial?: string | null
          updated_at?: string
          zoho_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_mapped_to_device_id_fkey"
            columns: ["mapped_to_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          notes: string | null
          project_id: string
          uploaded_by: string | null
          version: number | null
          zoho_attachment_id: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          notes?: string | null
          project_id: string
          uploaded_by?: string | null
          version?: number | null
          zoho_attachment_id?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          notes?: string | null
          project_id?: string
          uploaded_by?: string | null
          version?: number | null
          zoho_attachment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      file_imports: {
        Row: {
          column_mapping: Json | null
          created_at: string
          error_log: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          import_status: string | null
          imported_by: string | null
          imported_device_count: number | null
          parsed_data: Json | null
          project_id: string
          row_count: number | null
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string
          error_log?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          import_status?: string | null
          imported_by?: string | null
          imported_device_count?: number | null
          parsed_data?: Json | null
          project_id: string
          row_count?: number | null
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string
          error_log?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          import_status?: string | null
          imported_by?: string | null
          imported_device_count?: number | null
          parsed_data?: Json | null
          project_id?: string
          row_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "file_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plans: {
        Row: {
          created_at: string | null
          file_name: string
          file_type: string
          file_url: string
          height: number | null
          id: string
          location_id: string
          sort_order: number | null
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_type: string
          file_url: string
          height?: number | null
          id?: string
          location_id: string
          sort_order?: number | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          height?: number | null
          id?: string
          location_id?: string
          sort_order?: number | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      it_config: {
        Row: {
          card_reader_type: string | null
          created_at: string
          external_it_company: string | null
          id: string
          it_contact_external: string | null
          it_contact_internal: string | null
          it_notes: string | null
          project_id: string
          scan_ftp_path: string | null
          scan_ftp_server: string | null
          scan_ftp_user: string | null
          scan_methods: string[] | null
          scan_smb_server: string | null
          scan_smb_shared: boolean | null
          scan_smb_user: string | null
          scan_smtp_auth: boolean | null
          scan_smtp_port: string | null
          scan_smtp_sender: string | null
          scan_smtp_server: string | null
          software_fleet_proxy: string | null
          software_fleet_server: string | null
          software_followme_server: string | null
          software_followme_system: string | null
          software_notes: string | null
          software_print_name: string | null
          software_print_server: string | null
          software_scan_name: string | null
          software_scan_server: string | null
          training_type: string[] | null
          updated_at: string
        }
        Insert: {
          card_reader_type?: string | null
          created_at?: string
          external_it_company?: string | null
          id?: string
          it_contact_external?: string | null
          it_contact_internal?: string | null
          it_notes?: string | null
          project_id: string
          scan_ftp_path?: string | null
          scan_ftp_server?: string | null
          scan_ftp_user?: string | null
          scan_methods?: string[] | null
          scan_smb_server?: string | null
          scan_smb_shared?: boolean | null
          scan_smb_user?: string | null
          scan_smtp_auth?: boolean | null
          scan_smtp_port?: string | null
          scan_smtp_sender?: string | null
          scan_smtp_server?: string | null
          software_fleet_proxy?: string | null
          software_fleet_server?: string | null
          software_followme_server?: string | null
          software_followme_system?: string | null
          software_notes?: string | null
          software_print_name?: string | null
          software_print_server?: string | null
          software_scan_name?: string | null
          software_scan_server?: string | null
          training_type?: string[] | null
          updated_at?: string
        }
        Update: {
          card_reader_type?: string | null
          created_at?: string
          external_it_company?: string | null
          id?: string
          it_contact_external?: string | null
          it_contact_internal?: string | null
          it_notes?: string | null
          project_id?: string
          scan_ftp_path?: string | null
          scan_ftp_server?: string | null
          scan_ftp_user?: string | null
          scan_methods?: string[] | null
          scan_smb_server?: string | null
          scan_smb_shared?: boolean | null
          scan_smb_user?: string | null
          scan_smtp_auth?: boolean | null
          scan_smtp_port?: string | null
          scan_smtp_sender?: string | null
          scan_smtp_server?: string | null
          software_fleet_proxy?: string | null
          software_fleet_server?: string | null
          software_followme_server?: string | null
          software_followme_system?: string | null
          software_notes?: string | null
          software_print_name?: string | null
          software_print_server?: string | null
          software_scan_name?: string | null
          software_scan_server?: string | null
          training_type?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_street: string | null
          address_zip: string | null
          building: string | null
          created_at: string
          id: string
          location_type: string
          name: string
          notes: string | null
          parent_id: string | null
          project_id: string
          short_name: string | null
          sort_order: number | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_street?: string | null
          address_zip?: string | null
          building?: string | null
          created_at?: string
          id?: string
          location_type?: string
          name: string
          notes?: string | null
          parent_id?: string | null
          project_id: string
          short_name?: string | null
          sort_order?: number | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_street?: string | null
          address_zip?: string | null
          building?: string | null
          created_at?: string
          id?: string
          location_type?: string
          name?: string
          notes?: string | null
          parent_id?: string | null
          project_id?: string
          short_name?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string | null
          project_id: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          project_id?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          project_id?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_processing: {
        Row: {
          bank_interval: string | null
          billing_city: string | null
          billing_street: string | null
          billing_zip: string | null
          contract_end: string | null
          contract_start: string | null
          contract_type: string | null
          counter_interval: string | null
          created_at: string | null
          device_id: string | null
          factor: number | null
          finance_type: string | null
          free_start_phase: string | null
          goods_value: number | null
          id: string
          leasing_contract_nr: string | null
          leasing_share: number | null
          maintenance_share: number | null
          offer_order_nr: string | null
          old_device_pickup: string | null
          order_date: string | null
          order_number: string | null
          project_id: string
          purchase_order: string | null
          rate: number | null
          request_nr: string | null
          serial_number: string | null
          signing_authority: string | null
          site_conditions: string | null
          status: string | null
          steps: Json
          subject: string | null
          sx_contract_nr: string | null
          takeover_date: string | null
          term_months: number | null
          updated_at: string | null
          zoho_sales_order_id: string | null
        }
        Insert: {
          bank_interval?: string | null
          billing_city?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: string | null
          counter_interval?: string | null
          created_at?: string | null
          device_id?: string | null
          factor?: number | null
          finance_type?: string | null
          free_start_phase?: string | null
          goods_value?: number | null
          id?: string
          leasing_contract_nr?: string | null
          leasing_share?: number | null
          maintenance_share?: number | null
          offer_order_nr?: string | null
          old_device_pickup?: string | null
          order_date?: string | null
          order_number?: string | null
          project_id: string
          purchase_order?: string | null
          rate?: number | null
          request_nr?: string | null
          serial_number?: string | null
          signing_authority?: string | null
          site_conditions?: string | null
          status?: string | null
          steps?: Json
          subject?: string | null
          sx_contract_nr?: string | null
          takeover_date?: string | null
          term_months?: number | null
          updated_at?: string | null
          zoho_sales_order_id?: string | null
        }
        Update: {
          bank_interval?: string | null
          billing_city?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: string | null
          counter_interval?: string | null
          created_at?: string | null
          device_id?: string | null
          factor?: number | null
          finance_type?: string | null
          free_start_phase?: string | null
          goods_value?: number | null
          id?: string
          leasing_contract_nr?: string | null
          leasing_share?: number | null
          maintenance_share?: number | null
          offer_order_nr?: string | null
          old_device_pickup?: string | null
          order_date?: string | null
          order_number?: string | null
          project_id?: string
          purchase_order?: string | null
          rate?: number | null
          request_nr?: string | null
          serial_number?: string | null
          signing_authority?: string | null
          site_conditions?: string | null
          status?: string | null
          steps?: Json
          subject?: string | null
          sx_contract_nr?: string | null
          takeover_date?: string | null
          term_months?: number | null
          updated_at?: string | null
          zoho_sales_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_processing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          zoho_org_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          zoho_org_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          zoho_org_id?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          customer_contacts: Json | null
          customer_name: string
          customer_number: string | null
          id: string
          logistics_notes: string | null
          order_confirmed_at: string | null
          order_confirmed_by: string | null
          organization_id: string | null
          project_lead: string | null
          project_name: string | null
          project_number: string | null
          project_type: string
          quote_config: Json | null
          rollout_end: string | null
          rollout_start: string | null
          signed_document_id: string | null
          status: string
          technicians: string[] | null
          updated_at: string
          warehouse_address: string | null
          zoho_deal_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_contacts?: Json | null
          customer_name: string
          customer_number?: string | null
          id?: string
          logistics_notes?: string | null
          order_confirmed_at?: string | null
          order_confirmed_by?: string | null
          organization_id?: string | null
          project_lead?: string | null
          project_name?: string | null
          project_number?: string | null
          project_type?: string
          quote_config?: Json | null
          rollout_end?: string | null
          rollout_start?: string | null
          signed_document_id?: string | null
          status?: string
          technicians?: string[] | null
          updated_at?: string
          warehouse_address?: string | null
          zoho_deal_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_contacts?: Json | null
          customer_name?: string
          customer_number?: string | null
          id?: string
          logistics_notes?: string | null
          order_confirmed_at?: string | null
          order_confirmed_by?: string | null
          organization_id?: string | null
          project_lead?: string | null
          project_name?: string | null
          project_number?: string | null
          project_type?: string
          quote_config?: Json | null
          rollout_end?: string | null
          rollout_start?: string | null
          signed_document_id?: string | null
          status?: string
          technicians?: string[] | null
          updated_at?: string
          warehouse_address?: string | null
          zoho_deal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_lead_fkey"
            columns: ["project_lead"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rollout_logistics: {
        Row: {
          collection_point: string | null
          created_at: string
          daily_contact: string | null
          date: string | null
          departure_time: string | null
          hygiene_requirements: string | null
          id: string
          project_id: string
          rollout_day: number
          safety_instructions: string | null
          transport_notes: string | null
          vehicles: Json | null
        }
        Insert: {
          collection_point?: string | null
          created_at?: string
          daily_contact?: string | null
          date?: string | null
          departure_time?: string | null
          hygiene_requirements?: string | null
          id?: string
          project_id: string
          rollout_day: number
          safety_instructions?: string | null
          transport_notes?: string | null
          vehicles?: Json | null
        }
        Update: {
          collection_point?: string | null
          created_at?: string
          daily_contact?: string | null
          date?: string | null
          departure_time?: string | null
          hygiene_requirements?: string | null
          id?: string
          project_id?: string
          rollout_day?: number
          safety_instructions?: string | null
          transport_notes?: string | null
          vehicles?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rollout_logistics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_orders: {
        Row: {
          consumables: string | null
          contact_person: string | null
          created_at: string
          creator: string | null
          customer_address: string | null
          delivery_address: string | null
          delivery_date: string | null
          delivery_status: string
          delivery_time: string | null
          device_id: string | null
          device_internal_id: string | null
          end_check_date: string | null
          end_check_time: string | null
          floor: string | null
          id: string
          licenses: string | null
          manufacturer: string | null
          model: string | null
          network_settings: string | null
          options: string | null
          ow_number: string | null
          preparation_status: string
          project_id: string
          remarks: string | null
          room: string | null
          serial_number: string | null
          technician: string | null
          updated_at: string
          work_started: boolean | null
        }
        Insert: {
          consumables?: string | null
          contact_person?: string | null
          created_at?: string
          creator?: string | null
          customer_address?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_status?: string
          delivery_time?: string | null
          device_id?: string | null
          device_internal_id?: string | null
          end_check_date?: string | null
          end_check_time?: string | null
          floor?: string | null
          id?: string
          licenses?: string | null
          manufacturer?: string | null
          model?: string | null
          network_settings?: string | null
          options?: string | null
          ow_number?: string | null
          preparation_status?: string
          project_id: string
          remarks?: string | null
          room?: string | null
          serial_number?: string | null
          technician?: string | null
          updated_at?: string
          work_started?: boolean | null
        }
        Update: {
          consumables?: string | null
          contact_person?: string | null
          created_at?: string
          creator?: string | null
          customer_address?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_status?: string
          delivery_time?: string | null
          device_id?: string | null
          device_internal_id?: string | null
          end_check_date?: string | null
          end_check_time?: string | null
          floor?: string | null
          id?: string
          licenses?: string | null
          manufacturer?: string | null
          model?: string | null
          network_settings?: string | null
          options?: string | null
          ow_number?: string | null
          preparation_status?: string
          project_id?: string
          remarks?: string | null
          room?: string | null
          serial_number?: string | null
          technician?: string | null
          updated_at?: string
          work_started?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_orders_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_orders_technician_fkey"
            columns: ["technician"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          role: string
          short_code: string | null
          zoho_user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role: string
          short_code?: string | null
          zoho_user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role?: string
          short_code?: string | null
          zoho_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
