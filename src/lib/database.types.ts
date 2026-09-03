/**
 * Tipe hasil generate dari skema Supabase — JANGAN diedit manual.
 *
 * Regenerate setelah mengubah migrasi:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_simulation: boolean
          name: string
          sort_order: number
          store_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_simulation?: boolean
          name: string
          sort_order?: number
          store_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_simulation?: boolean
          name?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_simulation: boolean
          name: string
          store_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_simulation?: boolean
          name: string
          store_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_simulation?: boolean
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string
          expense_date: string
          id: string
          is_simulation: boolean
          note: string | null
          payment_source: Database["public"]["Enums"]["payment_source"]
          receipt_url: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["expense_status"]
          store_id: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          is_simulation?: boolean
          note?: string | null
          payment_source?: Database["public"]["Enums"]["payment_source"]
          receipt_url?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          store_id: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          is_simulation?: boolean
          note?: string | null
          payment_source?: Database["public"]["Enums"]["payment_source"]
          receipt_url?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          is_simulation: boolean
          low_stock_threshold: number
          name: string
          price: number
          sku: string | null
          stock: number
          store_id: string
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_simulation?: boolean
          low_stock_threshold?: number
          name: string
          price?: number
          sku?: string | null
          stock?: number
          store_id: string
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_simulation?: boolean
          low_stock_threshold?: number
          name?: string
          price?: number
          sku?: string | null
          stock?: number
          store_id?: string
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          code: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          pin_hash: string | null
          role: Database["public"]["Enums"]["user_role"]
          store_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          name: string
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          day_of_period: number
          frequency: Database["public"]["Enums"]["recurrence"]
          id: string
          is_active: boolean
          name: string
          next_due_date: string
          store_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          day_of_period?: number
          frequency?: Database["public"]["Enums"]["recurrence"]
          id?: string
          is_active?: boolean
          name: string
          next_due_date: string
          store_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          day_of_period?: number
          frequency?: Database["public"]["Enums"]["recurrence"]
          id?: string
          is_active?: boolean
          name?: string
          next_due_date?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          closed_at: string | null
          closing_cash: number | null
          difference: number | null
          expected_cash: number | null
          id: string
          is_simulation: boolean
          note: string | null
          opened_at: string
          opening_cash: number
          status: Database["public"]["Enums"]["shift_status"]
          store_id: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_cash?: number | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          is_simulation?: boolean
          note?: string | null
          opened_at?: string
          opening_cash?: number
          status?: Database["public"]["Enums"]["shift_status"]
          store_id: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          closing_cash?: number | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          is_simulation?: boolean
          note?: string | null
          opened_at?: string
          opening_cash?: number
          status?: Database["public"]["Enums"]["shift_status"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_logs: {
        Row: {
          change_qty: number
          created_at: string
          id: string
          is_simulation: boolean
          note: string | null
          product_id: string
          reason: Database["public"]["Enums"]["stock_reason"]
          reference_id: string | null
          stock_after: number
          store_id: string
          user_id: string | null
        }
        Insert: {
          change_qty: number
          created_at?: string
          id?: string
          is_simulation?: boolean
          note?: string | null
          product_id: string
          reason: Database["public"]["Enums"]["stock_reason"]
          reference_id?: string | null
          stock_after: number
          store_id: string
          user_id?: string | null
        }
        Update: {
          change_qty?: number
          created_at?: string
          id?: string
          is_simulation?: boolean
          note?: string | null
          product_id?: string
          reason?: Database["public"]["Enums"]["stock_reason"]
          reference_id?: string | null
          stock_after?: number
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          cashier_expense_limit: number
          created_at: string
          currency_prefix: string
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          receipt_footer: string | null
          simulation_mode: boolean
          timezone: string
        }
        Insert: {
          address?: string | null
          cashier_expense_limit?: number
          created_at?: string
          currency_prefix?: string
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          receipt_footer?: string | null
          simulation_mode?: boolean
          timezone?: string
        }
        Update: {
          address?: string | null
          cashier_expense_limit?: number
          created_at?: string
          currency_prefix?: string
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          receipt_footer?: string | null
          simulation_mode?: boolean
          timezone?: string
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          cost_at_sale: number
          discount: number
          id: string
          price_at_sale: number
          product_id: string | null
          product_name: string
          qty: number
          subtotal: number
          transaction_id: string
        }
        Insert: {
          cost_at_sale?: number
          discount?: number
          id?: string
          price_at_sale: number
          product_id?: string | null
          product_name: string
          qty: number
          subtotal: number
          transaction_id: string
        }
        Update: {
          cost_at_sale?: number
          discount?: number
          id?: string
          price_at_sale?: number
          product_id?: string | null
          product_name?: string
          qty?: number
          subtotal?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          change_amount: number
          client_ref: string | null
          code: string
          created_at: string
          discount: number
          id: string
          is_simulation: boolean
          note: string | null
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          shift_id: string | null
          store_id: string
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          change_amount?: number
          client_ref?: string | null
          code: string
          created_at?: string
          discount?: number
          id?: string
          is_simulation?: boolean
          note?: string | null
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          shift_id?: string | null
          store_id: string
          subtotal?: number
          total?: number
          user_id: string
        }
        Update: {
          change_amount?: number
          client_ref?: string | null
          code?: string
          created_at?: string
          discount?: number
          id?: string
          is_simulation?: boolean
          note?: string | null
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          shift_id?: string | null
          store_id?: string
          subtotal?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_change_qty: number
          p_note?: string
          p_product_id: string
          p_reason?: Database["public"]["Enums"]["stock_reason"]
        }
        Returns: {
          category_id: string | null
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          is_simulation: boolean
          low_stock_threshold: number
          name: string
          price: number
          sku: string | null
          stock: number
          store_id: string
          track_stock: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_user_pin: {
        Args: { p_code: string; p_pin: string; p_user_id: string }
        Returns: undefined
      }
      bootstrap_store: {
        Args: { p_address?: string; p_store_name: string }
        Returns: {
          address: string | null
          cashier_expense_limit: number
          created_at: string
          currency_prefix: string
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          receipt_footer: string | null
          simulation_mode: boolean
          timezone: string
        }
        SetofOptions: {
          from: "*"
          to: "stores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_shift: {
        Args: { p_closing_cash: number; p_note?: string; p_shift_id: string }
        Returns: {
          closed_at: string | null
          closing_cash: number | null
          difference: number | null
          expected_cash: number | null
          id: string
          is_simulation: boolean
          note: string | null
          opened_at: string
          opening_cash: number
          status: Database["public"]["Enums"]["shift_status"]
          store_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_expense: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_expense_date?: string
          p_note?: string
          p_payment_source?: Database["public"]["Enums"]["payment_source"]
          p_receipt_url?: string
          p_shift_id?: string
        }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string
          expense_date: string
          id: string
          is_simulation: boolean
          note: string | null
          payment_source: Database["public"]["Enums"]["payment_source"]
          receipt_url: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["expense_status"]
          store_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_sale: {
        Args: {
          p_client_ref?: string
          p_created_at?: string
          p_discount?: number
          p_items: Json
          p_note?: string
          p_paid_amount?: number
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_shift_id: string
        }
        Returns: {
          change_amount: number
          client_ref: string | null
          code: string
          created_at: string
          discount: number
          id: string
          is_simulation: boolean
          note: string | null
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          shift_id: string | null
          store_id: string
          subtotal: number
          total: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_expense: { Args: { p_expense_id: string }; Returns: undefined }
      generate_simulation_data: {
        Args: {
          p_days?: number
          p_trx_per_day_max?: number
          p_trx_per_day_min?: number
        }
        Returns: Json
      }
      is_active_member: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_description: string
          p_metadata?: Json
          p_store_id: string
        }
        Returns: undefined
      }
      low_stock_products: {
        Args: { p_simulation?: boolean }
        Returns: {
          category_id: string | null
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          is_simulation: boolean
          low_stock_threshold: number
          name: string
          price: number
          sku: string | null
          stock: number
          store_id: string
          track_stock: boolean
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_profile: {
        Args: never
        Returns: {
          code: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          pin_hash: string | null
          role: Database["public"]["Enums"]["user_role"]
          store_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_store_id: { Args: never; Returns: string }
      open_shift: {
        Args: { p_opening_cash?: number }
        Returns: {
          closed_at: string | null
          closing_cash: number | null
          difference: number | null
          expected_cash: number | null
          id: string
          is_simulation: boolean
          note: string | null
          opened_at: string
          opening_cash: number
          status: Database["public"]["Enums"]["shift_status"]
          store_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_compare: {
        Args: {
          p_from: string
          p_simulation?: boolean
          p_to: string
          p_user_id?: string
        }
        Returns: Json
      }
      report_dashboard: {
        Args: {
          p_from: string
          p_simulation?: boolean
          p_to: string
          p_user_id?: string
        }
        Returns: Json
      }
      reset_data: {
        Args: {
          p_confirmation: string
          p_type: Database["public"]["Enums"]["reset_type"]
        }
        Returns: Json
      }
      review_expense: {
        Args: { p_approve: boolean; p_expense_id: string }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string
          expense_date: string
          id: string
          is_simulation: boolean
          note: string | null
          payment_source: Database["public"]["Enums"]["payment_source"]
          receipt_url: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["expense_status"]
          store_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_my_pin: {
        Args: { p_code: string; p_pin: string }
        Returns: undefined
      }
      set_simulation_mode: {
        Args: { p_enabled: boolean }
        Returns: {
          address: string | null
          cashier_expense_limit: number
          created_at: string
          currency_prefix: string
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          receipt_footer: string | null
          simulation_mode: boolean
          timezone: string
        }
        SetofOptions: {
          from: "*"
          to: "stores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shift_expected_cash: { Args: { p_shift_id: string }; Returns: number }
      shift_report: { Args: { p_shift_id: string }; Returns: Json }
      store_timezone: { Args: { p_store_id: string }; Returns: string }
      verify_pin_login: {
        Args: { p_code: string; p_pin: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      void_transaction: {
        Args: { p_reason?: string; p_transaction_id: string }
        Returns: undefined
      }
    }
    Enums: {
      expense_status: "pending" | "approved" | "rejected"
      payment_method: "cash" | "qris" | "transfer" | "other"
      payment_source: "cash" | "non_cash"
      recurrence: "weekly" | "monthly"
      reset_type: "simulation" | "transactional" | "factory"
      shift_status: "open" | "closed"
      stock_reason: "initial" | "sale" | "purchase" | "adjustment" | "void"
      user_role: "admin" | "kasir"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
