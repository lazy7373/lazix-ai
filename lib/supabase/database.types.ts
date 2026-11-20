export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: { id: string; user_id: string; title: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; title?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; title?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      conversation_messages: {
        Row: { id: string; conversation_id: string; user_id: string; role: string; content: string; created_at: string };
        Insert: { id?: string; conversation_id: string; user_id: string; role: string; content: string; created_at?: string };
        Update: { id?: string; conversation_id?: string; user_id?: string; role?: string; content?: string; created_at?: string };
        Relationships: [];
      };
      memories: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
