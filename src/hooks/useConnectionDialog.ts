import { useCallback } from "react";
import { useWalletStore, getWalletKit, getWalletAccount, getAddress, getWalletClient } from "../store/walletStore";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import { ProposalTypes } from "@walletconnect/types";
import { hexToString } from "viem";
import toast from "react-hot-toast";


const SUPPORTED_CHAINS = [
    "eip155:11155111", // Sepolia testnet
  ];
  
const SUPPORTED_METHODS = [
    "eth_sendTransaction",
    "personal_sign",
  ];
  
const SUPPORTED_EVENTS = [
    "chainChanged",
    "accountsChanged",
  ];

type DialogType = "proposal" | "request" | "sendTransaction";

export function useConnectionDialog(
  type: DialogType,
  onOpenChange: (open: boolean) => void
) {
  const { data, setActiveSessions } = useWalletStore();
  const walletKit = getWalletKit();

  const getMessage = useCallback(() => {
    if (
      type === "request" &&
      data.requestEvent?.params?.request?.method === "personal_sign"
    ) {
      return {
        message: data.requestEvent?.params?.request?.params[0],
        dappUrl: data.requestEvent?.params?.request?.params[1] || ''
      };
    }
    return {
      message: '',
      dappUrl: ''
    };
  }, [type, data.requestEvent]);

  // Called when the user approves the connection proposal
  const handleApproveProposal = useCallback(async () => {
    try {
      const address = getAddress();
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: data.proposal?.params as ProposalTypes.Struct,
        supportedNamespaces: {
          eip155: {
            chains: SUPPORTED_CHAINS,
            methods: SUPPORTED_METHODS,
            events: SUPPORTED_EVENTS,
            accounts: [`eip155:11155111:${address}`],
          },
        },
      });

      // Approve the session
      await walletKit.approveSession({
        id: data.proposal?.id as number,
        namespaces: approvedNamespaces,
      });
      // Update the active sessions after approval
      setActiveSessions(walletKit.getActiveSessions());
      toast.success("Session approved");
      onOpenChange(false);
    } catch (error) {
      console.error("Error approving session:", error);
      await handleRejectProposal();
    }
  }, [data.proposal, walletKit, onOpenChange]);

  // Called when the user approves the sign request
  const handleApproveSignRequest = useCallback(async () => {
    try {
      const client = getWalletClient();

      console.log("request", data.requestEvent);

      if (data.requestEvent?.params?.request?.method === "personal_sign") {
        // Get the message to sign
        const requestParamsMessage =
          data.requestEvent?.params?.request?.params[0];

        // Convert the message to a string
        const message = requestParamsMessage;

        // Sign the message
        const signature = await client.signMessage({
          message,
          account: getWalletAccount() as `0x${string}`,
        });

        // Respond to the session request with the signature
        await walletKit!.respondSessionRequest({
          topic: data.requestEvent?.topic as string,
          response: {
            id: data.requestEvent?.id as number,
            result: signature,
            jsonrpc: "2.0",
          },
        });
        onOpenChange(false);
        toast.success("Message signed successfully!");
      } else if (
        data.requestEvent?.params?.request?.method === "eth_sendTransaction"
      ) {
        onOpenChange(false);
        throw new Error("Not supported");
      }
    } catch (error) {
      console.error("Error responding to session request:", error);
      toast.error("Error");
    }
  }, [data.requestEvent, walletKit, onOpenChange]);

  // Called when the user rejects the connection proposal
  const handleRejectProposal = useCallback(async () => {
    try {
      // Reject the session proposal with the user rejected reason
      await walletKit!.rejectSession({
        id: data.proposal?.id as number,
        reason: getSdkError("USER_REJECTED"),
      });
      toast.success("Session rejected");
      onOpenChange(false);
    } catch (error) {
      console.error("Error rejecting session:", error);
      toast.error("Error rejecting session");
    }
  }, [data.proposal, walletKit, onOpenChange]);

  const handleRejectRequest = useCallback(async () => {
    try {
      const response = {
        id: data.requestEvent?.id as number,
        jsonrpc: "2.0",
        error: {
          code: 5000,
          message: "User rejected.",
        },
      };

      await walletKit!.respondSessionRequest({
        topic: data.requestEvent?.topic as string,
        response,
      });
      onOpenChange(false);
      toast.success("Request rejected");
    } catch (error) {
      console.error("Error rejecting a request:", error);
      toast.error("Error rejecting a request");
    }
  }, [data.requestEvent, walletKit, onOpenChange]);

  return {
    handleApproveProposal,
    handleApproveSignRequest,
    handleRejectProposal,
    handleRejectRequest,
    getMessage,
  };
}
