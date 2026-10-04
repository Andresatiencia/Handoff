import type { Listing } from "./listings";

export type User = { id: number; name: string; email: string; university: string; emailVerified: boolean; emailVerificationRequired: boolean };
export type Conversation = {
  id: number; listingId: number; buyerId: number; sellerId: number;
  title: string; buyerName: string; sellerName: string; status: Listing["status"];
};
export type Message = { id: number; conversationId: number; senderId: number; senderName: string; text: string; createdAt: string };
