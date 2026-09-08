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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
          slug: string
          wp_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          slug: string
          wp_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          slug?: string
          wp_id?: number | null
        }
        Relationships: []
      }
      coalition_links: {
        Row: {
          badge: string | null
          category: string
          created_at: string
          description: string
          name: string
          slug: string
          sort_order: number
          url: string
        }
        Insert: {
          badge?: string | null
          category?: string
          created_at?: string
          description?: string
          name: string
          slug: string
          sort_order?: number
          url?: string
        }
        Update: {
          badge?: string | null
          category?: string
          created_at?: string
          description?: string
          name?: string
          slug?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string
          email_sent_at: string | null
          id: number
          message: string
          name: string
          wants_copy: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          email_sent_at?: string | null
          id?: number
          message: string
          name: string
          wants_copy?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          email_sent_at?: string | null
          id?: number
          message?: string
          name?: string
          wants_copy?: boolean | null
        }
        Relationships: []
      }
      content: {
        Row: {
          body: string | null
          created_at: string | null
          excerpt: string | null
          featured_image: string | null
          id: number
          metadata: Json | null
          published_at: string | null
          search_vector: unknown
          slug: string
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: number
          metadata?: Json | null
          published_at?: string | null
          search_vector?: unknown
          slug: string
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: number
          metadata?: Json | null
          published_at?: string | null
          search_vector?: unknown
          slug?: string
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          amount: number | null
          code: string
          created_at: string | null
          discount_type: string | null
          expiry_date: string | null
          id: number
          stripe_coupon_id: string | null
          times_used: number | null
          usage_limit: number | null
        }
        Insert: {
          amount?: number | null
          code: string
          created_at?: string | null
          discount_type?: string | null
          expiry_date?: string | null
          id?: number
          stripe_coupon_id?: string | null
          times_used?: number | null
          usage_limit?: number | null
        }
        Update: {
          amount?: number | null
          code?: string
          created_at?: string | null
          discount_type?: string | null
          expiry_date?: string | null
          id?: number
          stripe_coupon_id?: string | null
          times_used?: number | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          category: string
          component_stack: string | null
          created_at: string
          digest: string | null
          fingerprint: string
          id: number
          message: string
          path: string | null
          stack: string | null
          user_agent: string | null
        }
        Insert: {
          category?: string
          component_stack?: string | null
          created_at?: string
          digest?: string | null
          fingerprint: string
          id?: never
          message: string
          path?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Update: {
          category?: string
          component_stack?: string | null
          created_at?: string
          digest?: string | null
          fingerprint?: string
          id?: never
          message?: string
          path?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          address: string
          category: string
          created_at: string
          date_label: string
          description: string
          ends_at: string | null
          highlight: boolean
          location_name: string
          rsvp_url: string
          slug: string
          sort_order: number
          starts_at: string | null
          time_label: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string
          category: string
          created_at?: string
          date_label: string
          description?: string
          ends_at?: string | null
          highlight?: boolean
          location_name?: string
          rsvp_url?: string
          slug: string
          sort_order?: number
          starts_at?: string | null
          time_label: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          category?: string
          created_at?: string
          date_label?: string
          description?: string
          ends_at?: string | null
          highlight?: boolean
          location_name?: string
          rsvp_url?: string
          slug?: string
          sort_order?: number
          starts_at?: string | null
          time_label?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_photos: {
        Row: {
          alt: string
          caption: string
          category: string
          created_at: string
          date_label: string
          id: number
          is_hero: boolean
          is_pair: boolean
          location: string
          photographer: string
          sign_quote: string | null
          slug: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt?: string
          caption?: string
          category?: string
          created_at?: string
          date_label?: string
          id?: number
          is_hero?: boolean
          is_pair?: boolean
          location?: string
          photographer?: string
          sign_quote?: string | null
          slug: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt?: string
          caption?: string
          category?: string
          created_at?: string
          date_label?: string
          id?: number
          is_hero?: boolean
          is_pair?: boolean
          location?: string
          photographer?: string
          sign_quote?: string | null
          slug?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: []
      }
      newsletters: {
        Row: {
          created_at: string
          date_label: string
          description: string
          published_at: string | null
          slug: string
          sort_order: number
          title: string
          topics: string[]
        }
        Insert: {
          created_at?: string
          date_label?: string
          description?: string
          published_at?: string | null
          slug: string
          sort_order?: number
          title: string
          topics?: string[]
        }
        Update: {
          created_at?: string
          date_label?: string
          description?: string
          published_at?: string | null
          slug?: string
          sort_order?: number
          title?: string
          topics?: string[]
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: number
          order_id: number | null
          product_id: number | null
          product_name: string | null
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          order_id?: number | null
          product_id?: number | null
          product_name?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          order_id?: number | null
          product_id?: number | null
          product_name?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          billing_address: Json | null
          coupon_code: string | null
          created_at: string | null
          currency: string | null
          discount_amount: number | null
          id: number
          metadata: Json | null
          shipping_address: Json | null
          shipping_amount: number | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number | null
          total: number | null
          tracking_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          billing_address?: Json | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          id?: number
          metadata?: Json | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          total?: number | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          billing_address?: Json | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          id?: number
          metadata?: Json | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          total?: number | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          category: string
          created_at: string
          description: string
          name: string
          slug: string
          sort_order: number
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          name: string
          slug: string
          sort_order?: number
          url?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          name?: string
          slug?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_id: number
          product_id: number
        }
        Insert: {
          category_id: number
          product_id: number
        }
        Update: {
          category_id?: number
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          attributes: Json | null
          created_at: string | null
          dimensions: Json | null
          id: number
          image_url: string | null
          metadata: Json | null
          price: number | null
          product_id: number | null
          sku: string | null
          stock_status: string | null
          weight: number | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          dimensions?: Json | null
          id?: number
          image_url?: string | null
          metadata?: Json | null
          price?: number | null
          product_id?: number | null
          sku?: string | null
          stock_status?: string | null
          weight?: number | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          dimensions?: Json | null
          id?: number
          image_url?: string | null
          metadata?: Json | null
          price?: number | null
          product_id?: number | null
          sku?: string | null
          stock_status?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json | null
          created_at: string | null
          date_created: string | null
          date_modified: string | null
          description: string | null
          dimensions: Json | null
          gallery_urls: Json | null
          id: number
          image_url: string | null
          metadata: Json | null
          name: string
          price: number
          regular_price: number | null
          sale_price: number | null
          search_vector: unknown
          short_description: string | null
          sku: string | null
          slug: string
          stock_status: string | null
          weight: number | null
          wp_id: number | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          date_created?: string | null
          date_modified?: string | null
          description?: string | null
          dimensions?: Json | null
          gallery_urls?: Json | null
          id?: number
          image_url?: string | null
          metadata?: Json | null
          name: string
          price?: number
          regular_price?: number | null
          sale_price?: number | null
          search_vector?: unknown
          short_description?: string | null
          sku?: string | null
          slug: string
          stock_status?: string | null
          weight?: number | null
          wp_id?: number | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          date_created?: string | null
          date_modified?: string | null
          description?: string | null
          dimensions?: Json | null
          gallery_urls?: Json | null
          id?: number
          image_url?: string | null
          metadata?: Json | null
          name?: string
          price?: number
          regular_price?: number | null
          sale_price?: number | null
          search_vector?: unknown
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_status?: string | null
          weight?: number | null
          wp_id?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          settings: Json | null
          updated_at: string | null
          user_id: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          settings?: Json | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          settings?: Json | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comments: Json | null
          created_at: string | null
          id: string
          pr_number: number
          repo_full_name: string
          score: number | null
          status: string | null
          summary: string | null
        }
        Insert: {
          comments?: Json | null
          created_at?: string | null
          id?: string
          pr_number: number
          repo_full_name: string
          score?: number | null
          status?: string | null
          summary?: string | null
        }
        Update: {
          comments?: Json | null
          created_at?: string | null
          id?: string
          pr_number?: number
          repo_full_name?: string
          score?: number | null
          status?: string | null
          summary?: string | null
        }
        Relationships: []
      }
      search_rate_limit: {
        Row: {
          created_at: string
          id: number
          ip: string
        }
        Insert: {
          created_at?: string
          id?: number
          ip: string
        }
        Update: {
          created_at?: string
          id?: number
          ip?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      decrement_stock: {
        Args: { decrement_by?: number; p_id: number }
        Returns: undefined
      }
      get_user_org_id: { Args: never; Returns: string }
      is_service_role: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_ip_address?: string
          p_metadata?: Json
          p_resource_id?: string
          p_resource_type: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      move_to_dlq: { Args: never; Returns: undefined }
      search_content: {
        Args: { max_rows?: number; search_query: string }
        Returns: {
          created_at: string
          id: number
          rank: number
          slug: string
          title: string
          type: string
        }[]
      }
      search_products: {
        Args: { max_rows?: number; search_query: string }
        Returns: {
          id: number
          image_url: string
          name: string
          price: number
          rank: number
          regular_price: number
          sale_price: number
          slug: string
          stock_status: string
        }[]
      }
      submit_contact_submission: {
        Args: {
          p_email: string
          p_message: string
          p_name: string
          p_wants_copy?: boolean
        }
        Returns: number
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
