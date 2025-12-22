
import { supabase } from "@/integrations/supabase/client";

export const pluggyService = {
    async _invoke(action: string, payload: any = {}) {
        const { data, error } = await supabase.functions.invoke('pluggy-proxy', {
            body: { action, ...payload }
        });

        if (error) {
            console.error(`Pluggy Service Error (${action}):`, error);
            // Hint to the developer/user
            console.warn("If you receive 'Edge Function returned a non-2xx status code', typically it means the Function crashed or missing environment variables (PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET). Check Supabase Dashboard > Edge Functions > Logs.");
            throw error;
        }
        return data;
    },

    async createConnectToken() {
        return this._invoke('createConnectToken');
    },

    async fetchAccounts(itemId: string) {
        return this._invoke('fetchAccounts', { itemId });
    },

    async fetchTransactions(accountId: string) {
        return this._invoke('fetchTransactions', { accountId });
    },

    async fetchItem(itemId: string) {
        return this._invoke('fetchItem', { itemId });
    }
};
