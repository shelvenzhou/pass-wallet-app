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
      
      if (!data.proposal?.id) {
        throw new Error('No proposal ID found');
      }

      const approvedNamespaces = buildApprovedNamespaces({
        proposal: data.proposal.params as ProposalTypes.Struct,
        supportedNamespaces: {
          eip155: {
            chains: SUPPORTED_CHAINS,
            methods: SUPPORTED_METHODS,
            events: SUPPORTED_EVENTS,
            accounts: [`eip155:11155111:${address}`],
          },
        },
      });

      console.log('Approving session with ID:', data.proposal.id);
      console.log('Namespaces:', approvedNamespaces);

      // Approve the session
      await walletKit!.approveSession({
        id: parseInt(data.proposal.id.toString()),
        namespaces: approvedNamespaces,
      });

      // Update the active sessions after approval
      setActiveSessions(walletKit!.getActiveSessions());
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
      toast.success("Signing message");
      console.log("request", data.requestEvent);

      if (data.requestEvent?.params?.request?.method === "personal_sign") {
        const requestParamsMessage = data.requestEvent?.params?.request?.params[0];
        
        // Call the sign API endpoint
        const response = await fetch('/api/sign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: requestParamsMessage,
          }),
        });
  
        if (!response.ok) {
          throw new Error('Failed to sign message');
        }
  
        const { signature } = await response.json();
  
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
      }
    } catch (error) {
      console.error("Error responding to session request:", error);
      toast.error("Error signing message");
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
