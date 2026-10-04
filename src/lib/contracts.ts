import type { Listing } from "./listings";

export type User = { id: number; name: string; email: string; university: string };
export type Conversation = {
  id: number; listingId: number; buyerId: number; sellerId: number;
  title: string; buyerName: string; sellerName: string; status: Listing["status"];
  unreadCount: number;
};
export type Message = { id: number; conversationId: number; senderId: number; senderName: string; text: string; createdAt: string };
