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
    PostgrestVersion: "14.17"
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
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string
          email_sent_at: string | null
          id: number
          message: string
          name: string
          wants_copy: boolean
        }
        Insert: {
          created_at?: string | null
          email: string
          email_sent_at?: string | null
          id?: number
          message: string
          name: string
          wants_copy?: boolean
        }
        Update: {
          created_at?: string | null
          email?: string
          email_sent_at?: string | null
          id?: number
          message?: string
          name?: string
          wants_copy?: boolean
        }
        Relationships: []
      }
      content: {
        Row: {
          body: string | null
          created_at: string | null
          id: number
          published_at: string | null
          search_vector: unknown
          slug: string
          status: string | null
          title: string
          type: string | null
          wp_id: number | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: number
          published_at?: string | null
          search_vector?: unknown
          slug: string
          status?: string | null
          title: string
          type?: string | null
          wp_id?: number | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: number
          published_at?: string | null
          search_vector?: unknown
          slug?: string
          status?: string | null
          title?: string
          type?: string | null
          wp_id?: number | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          amount: number | null
          code: string
          discount_type: string | null
          expiry_date: string | null
          id: number
          stripe_coupon_id: string | null
          wp_id: number | null
        }
        Insert: {
          amount?: number | null
          code: string
          discount_type?: string | null
          expiry_date?: string | null
          id?: number
          stripe_coupon_id?: string | null
          wp_id?: number | null
        }
        Update: {
          amount?: number | null
          code?: string
          discount_type?: string | null
          expiry_date?: string | null
          id?: number
          stripe_coupon_id?: string | null
          wp_id?: number | null
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
      order_items: {
        Row: {
          id: number
          order_id: number | null
          product_id: number | null
          product_name: string | null
          quantity: number | null
          total: number | null
        }
        Insert: {
          id?: number
          order_id?: number | null
          product_id?: number | null
          product_name?: string | null
          quantity?: number | null
          total?: number | null
        }
        Update: {
          id?: number
          order_id?: number | null
          product_id?: number | null
          product_name?: string | null
          quantity?: number | null
          total?: number | null
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
          customer_id: number | null
          id: number
          payment_method: string | null
          shipping_address: Json | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          total_amount: number | null
          tracking_number: string | null
          wp_id: number | null
        }
        Insert: {
          admin_notes?: string | null
          billing_address?: Json | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: number | null
          id?: number
          payment_method?: string | null
          shipping_address?: Json | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_amount?: number | null
          tracking_number?: string | null
          wp_id?: number | null
        }
        Update: {
          admin_notes?: string | null
          billing_address?: Json | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: number | null
          id?: number
          payment_method?: string | null
          shipping_address?: Json | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_amount?: number | null
          tracking_number?: string | null
          wp_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          id: number
          image_url: string | null
          price: number | null
          product_id: number | null
          regular_price: number | null
          sale_price: number | null
          sku: string | null
          stock_status: string | null
          weight: string | null
          wp_id: number | null
        }
        Insert: {
          attributes?: Json | null
          id?: number
          image_url?: string | null
          price?: number | null
          product_id?: number | null
          regular_price?: number | null
          sale_price?: number | null
          sku?: string | null
          stock_status?: string | null
          weight?: string | null
          wp_id?: number | null
        }
        Update: {
          attributes?: Json | null
          id?: number
          image_url?: string | null
          price?: number | null
          product_id?: number | null
          regular_price?: number | null
          sale_price?: number | null
          sku?: string | null
          stock_status?: string | null
          weight?: string | null
          wp_id?: number | null
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
          created_at: string | null
          date_created: string | null
          description: string | null
          gallery_urls: Json | null
          id: number
          image_url: string | null
          name: string
          price: number
          regular_price: number | null
          sale_price: number | null
          search_vector: unknown
          short_description: string | null
          sku: string | null
          slug: string
          stock_status: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          weight: string | null
          wp_id: number | null
        }
        Insert: {
          created_at?: string | null
          date_created?: string | null
          description?: string | null
          gallery_urls?: Json | null
          id?: number
          image_url?: string | null
          name: string
          price: number
          regular_price?: number | null
          sale_price?: number | null
          search_vector?: unknown
          short_description?: string | null
          sku?: string | null
          slug: string
          stock_status?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          weight?: string | null
          wp_id?: number | null
        }
        Update: {
          created_at?: string | null
          date_created?: string | null
          description?: string | null
          gallery_urls?: Json | null
          id?: number
          image_url?: string | null
          name?: string
          price?: number
          regular_price?: number | null
          sale_price?: number | null
          search_vector?: unknown
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_status?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          weight?: string | null
          wp_id?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string | null
          id: number
          is_admin: boolean
          last_name: string | null
          registered_at: string | null
          settings: Json | null
          stripe_customer_id: string | null
          user_id: string | null
          username: string | null
          wp_id: number | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: number
          is_admin?: boolean
          last_name?: string | null
          registered_at?: string | null
          settings?: Json | null
          stripe_customer_id?: string | null
          user_id?: string | null
          username?: string | null
          wp_id?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: number
          is_admin?: boolean
          last_name?: string | null
          registered_at?: string | null
          settings?: Json | null
          stripe_customer_id?: string | null
          user_id?: string | null
          username?: string | null
          wp_id?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_email: string | null
          author_name: string | null
          content: string | null
          created_at: string | null
          id: number
          product_id: number | null
          rating: number | null
          wp_id: number | null
        }
        Insert: {
          author_email?: string | null
          author_name?: string | null
          content?: string | null
          created_at?: string | null
          id?: number
          product_id?: number | null
          rating?: number | null
          wp_id?: number | null
        }
        Update: {
          author_email?: string | null
          author_name?: string | null
          content?: string | null
          created_at?: string | null
          id?: number
          product_id?: number | null
          rating?: number | null
          wp_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_stock: {
        Args: { decrement_by: number; p_id: number }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      replace_media_urls: {
        Args: { new_base: string; old_base: string }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
