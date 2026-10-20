// BACKEND ONLY. Anonymises customer data while retaining financial records.
import { compare } from "bcryptjs";
import { listFolder, remove } from "@floot/storage";
import { db } from "./db";
import { HttpError } from "./requireRole";

const partnerAccountMessage =
  "Partner and admin accounts are linked to payout, KYC and tax records. Please contact platr™ Support at /support to close this account.";

export const accountDeletion = {
  async deleteCustomerAccount(
    userId: number,
    password: string,
  ): Promise<{ retained: string[] }> {
    try {
      const user = await db
        .selectFrom("users")
        .select(["id", "email", "role", "deletedAt"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user || user.deletedAt) {
        throw new HttpError(404, "Account not found");
      }
      if (user.role !== "user") {
        throw new HttpError(403, partnerAccountMessage);
      }

      const credentials = await db
        .selectFrom("userPasswords")
        .select("passwordHash")
        .where("userId", "=", userId)
        .executeTakeFirst();

      if (!credentials || !(await compare(password, credentials.passwordHash))) {
        throw new HttpError(400, "Incorrect password");
      }

      // Check blockers after locking the user, immediately before anonymisation.
      const photoFiles = await db.transaction().execute(async (trx) => {
        const currentUser = await trx
          .selectFrom("users")
          .select(["email", "role", "deletedAt"])
          .where("id", "=", userId)
          .forUpdate()
          .executeTakeFirst();

        if (!currentUser || currentUser.deletedAt) {
          throw new HttpError(404, "Account not found");
        }
        if (currentUser.role !== "user") {
          throw new HttpError(403, partnerAccountMessage);
        }

        const activeOrder = await trx
          .selectFrom("orders")
          .select("id")
          .where("customerUserId", "=", userId)
          .where("status", "in", [
            "placed",
            "accepted",
            "preparing",
            "ready",
            "picked_up",
          ])
          .executeTakeFirst();
        if (activeOrder) {
          throw new HttpError(
            409,
            "You have an active order. Please wait until it is delivered or cancelled.",
          );
        }

        const processingComplaint = await trx
          .selectFrom("foodComplaints")
          .select("id")
          .where("customerUserId", "=", userId)
          .where((eb) =>
            eb.or([
              eb("status", "=", "pending"),
              eb("refundStatus", "=", "processing"),
            ]),
          )
          .executeTakeFirst();
        if (processingComplaint) {
          throw new HttpError(
            409,
            "A food complaint/refund is still being processed.",
          );
        }

        const pendingWalletTransaction = await trx
          .selectFrom("walletTransactions")
          .select("id")
          .where("userId", "=", userId)
          .where("status", "=", "pending")
          .executeTakeFirst();
        if (pendingWalletTransaction) {
          throw new HttpError(409, "A wallet top-up is still processing.");
        }

        const complaints = await trx
          .selectFrom("foodComplaints")
          .select("imageFiles")
          .where("customerUserId", "=", userId)
          .execute();
        const files = [
          ...new Set(complaints.flatMap((complaint) => complaint.imageFiles)),
        ];

        const originalEmail = currentUser.email;
        const now = new Date();
        const matchingTickets = trx
          .selectFrom("supportTickets")
          .select("id")
          .where((eb) =>
            eb.or([
              eb("userId", "=", userId),
              eb("email", "=", originalEmail),
            ]),
          );

        await trx
          .updateTable("supportTicketMessages")
          .set({
            senderEmail: "deleted@deleted.invalid",
            bodyText: "Removed on account deletion",
          })
          .where("direction", "=", "inbound")
          .where("ticketId", "in", matchingTickets)
          .execute();

        await trx
          .updateTable("supportTickets")
          .set({
            name: "Deleted user",
            email: "deleted@deleted.invalid",
            userId: null,
          })
          .where((eb) =>
            eb.or([
              eb("userId", "=", userId),
              eb("email", "=", originalEmail),
            ]),
          )
          .execute();

        await trx
          .updateTable("orders")
          .set({
            deliveryAddress: "Removed on account deletion",
            deliveryPhone: "",
            recipientName: null,
            notes: null,
            deliveryLat: null,
            deliveryLng: null,
          })
          .where("customerUserId", "=", userId)
          .execute();

        await trx
          .updateTable("orderRatings")
          .set({ comment: null })
          .where("customerUserId", "=", userId)
          .execute();

        await trx
          .updateTable("foodComplaints")
          .set({
            description: "Removed on account deletion",
            imageFiles: [],
          })
          .where("customerUserId", "=", userId)
          .execute();

        await trx
          .updateTable("emailNotifications")
          .set({ recipient: "deleted@deleted.invalid" })
          .where("recipient", "=", originalEmail)
          .execute();

        await trx
          .deleteFrom("sessions")
          .where("userId", "=", userId)
          .execute();
        await trx
          .deleteFrom("userPasswords")
          .where("userId", "=", userId)
          .execute();
        await trx
          .deleteFrom("emailOtpChallenges")
          .where((eb) =>
            eb.or([
              eb("userId", "=", userId),
              eb("email", "=", originalEmail),
            ]),
          )
          .execute();
        await trx
          .deleteFrom("passwordResetCodes")
          .where("userId", "=", userId)
          .execute();
        await trx
          .deleteFrom("customerAddresses")
          .where("userId", "=", userId)
          .execute();
        await trx
          .deleteFrom("calls")
          .where((eb) =>
            eb.or([
              eb("callerUserId", "=", userId),
              eb("calleeUserId", "=", userId),
            ]),
          )
          .execute();
        await trx
          .deleteFrom("loginAttempts")
          .where("email", "=", originalEmail)
          .execute();
        await trx
          .deleteFrom("legacyContactMessages")
          .where("email", "=", originalEmail)
          .execute();

        await trx
          .updateTable("users")
          .set({
            email: `deleted-${userId}-${crypto.randomUUID()}@deleted.invalid`,
            displayName: "Deleted user",
            avatarUrl: null,
            phone: null,
            emailVerifiedAt: null,
            otpExempt: false,
            allowRestaurantCalls: false,
            vegMode: false,
            deletedAt: now,
            updatedAt: now,
          })
          .where("id", "=", userId)
          .execute();

        return files;
      });

      // Storage is external to the DB transaction. A failed removal must not
      // turn a committed account deletion into a failed API response.
      for (const filename of photoFiles) {
        try {
          const result = await remove({ visibility: "private", filename });
          if (!result.ok) {
            console.error("Failed to remove deleted account complaint photo:", {
              filename,
              error: result.error,
            });
          }
        } catch (error) {
          console.error("Failed to remove deleted account complaint photo:", {
            filename,
            error,
          });
        }
      }

      // Public avatar uploads use unique filenames. Remove every file in the
      // user's folder, including uploads that were never saved to the profile.
      const avatarFolder = `avatars/${userId}/`;
      try {
        let continuationToken: string | undefined;
        do {
          const listing = await listFolder({
            visibility: "public",
            key: avatarFolder,
            ...(continuationToken ? { continuationToken } : {}),
          });
          if (!listing.ok) {
            console.error("Failed to list deleted account avatars:", listing.error);
            break;
          }

          for (const key of listing.files.map((file) => file.key)) {
            if (!key.startsWith(`public/${avatarFolder}`)) {
              console.error("Unexpected avatar storage key:", key);
              continue;
            }
            try {
              const result = await remove({
                visibility: "public",
                filename: key.slice("public/".length),
              });
              if (!result.ok) {
                console.error("Failed to remove deleted account avatar:", {
                  key,
                  error: result.error,
                });
              }
            } catch (error) {
              console.error("Failed to remove deleted account avatar:", { key, error });
            }
          }
          continuationToken = listing.nextContinuationToken;
        } while (continuationToken);
      } catch (error) {
        console.error("Failed to list deleted account avatars:", error);
      }

      return {
        retained: [
          "Order, payment, tax and refund records (anonymised)",
          "platr™ Wallet transaction history",
          "Star ratings without comments",
        ],
      };
    } catch (error) {
      console.error("Customer account deletion failed:", error);
      throw error;
    }
  },
};