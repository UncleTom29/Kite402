// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiSigOperator
 * @notice M-of-N multisig for fleet governance. Governs high-value vault operations.
 *         Withdrawals above HIGH_VALUE_THRESHOLD have a 24-hour timelock.
 */
contract MultiSigOperator {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant TIMELOCK_DURATION = 24 hours;
    uint256 public constant HIGH_VALUE_THRESHOLD = 1_000e6; // 1000 USDC (6 decimals)

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Proposal {
        address target;
        bytes callData;
        string description;
        uint256 proposedAt;
        uint256 executeAfter;  // 0 = no timelock
        uint256 approvalCount;
        bool executed;
        bool cancelled;
        mapping(address => bool) approved;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public threshold;

    mapping(uint256 => Proposal) private _proposals;
    uint256 public proposalCount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ActionProposed(uint256 indexed proposalId, address indexed proposer, address target, string description);
    event ActionApproved(uint256 indexed proposalId, address indexed signer, uint256 approvalCount);
    event ActionExecuted(uint256 indexed proposalId, address indexed executor);
    event ApprovalRevoked(uint256 indexed proposalId, address indexed signer);
    event ActionCancelled(uint256 indexed proposalId);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotSigner();
    error InvalidThreshold();
    error ProposalNotFound(uint256 proposalId);
    error AlreadyApproved(uint256 proposalId);
    error NotApproved(uint256 proposalId);
    error ThresholdNotMet(uint256 approvals, uint256 required);
    error TimelockActive(uint256 executeAfter, uint256 currentTime);
    error AlreadyExecuted(uint256 proposalId);
    error ExecutionFailed(bytes returnData);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address[] memory _signers, uint256 _threshold) {
        if (_threshold == 0 || _threshold > _signers.length) revert InvalidThreshold();

        for (uint256 i = 0; i < _signers.length; i++) {
            address s = _signers[i];
            require(s != address(0) && !isSigner[s], "MultiSig: invalid signer");
            isSigner[s] = true;
            signers.push(s);
        }
        threshold = _threshold;
    }

    // -------------------------------------------------------------------------
    // Propose
    // -------------------------------------------------------------------------

    function proposeAction(
        address target,
        bytes calldata callData,
        string calldata description
    ) external returns (uint256 proposalId) {
        if (!isSigner[msg.sender]) revert NotSigner();

        proposalId = proposalCount++;
        Proposal storage p = _proposals[proposalId];
        p.target = target;
        p.callData = callData;
        p.description = description;
        p.proposedAt = block.timestamp;

        // Apply 24h timelock for high-value withdrawals (detect by calldata size and selector)
        bool isHighValue = _isHighValueWithdrawal(callData);
        p.executeAfter = isHighValue ? block.timestamp + TIMELOCK_DURATION : 0;

        emit ActionProposed(proposalId, msg.sender, target, description);
    }

    // -------------------------------------------------------------------------
    // Approve
    // -------------------------------------------------------------------------

    function approveAction(uint256 proposalId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        Proposal storage p = _proposals[proposalId];
        if (p.proposedAt == 0) revert ProposalNotFound(proposalId);
        if (p.executed || p.cancelled) revert AlreadyExecuted(proposalId);
        if (p.approved[msg.sender]) revert AlreadyApproved(proposalId);

        p.approved[msg.sender] = true;
        p.approvalCount++;

        emit ActionApproved(proposalId, msg.sender, p.approvalCount);
    }

    // -------------------------------------------------------------------------
    // Revoke
    // -------------------------------------------------------------------------

    function revokeApproval(uint256 proposalId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        Proposal storage p = _proposals[proposalId];
        if (p.proposedAt == 0) revert ProposalNotFound(proposalId);
        if (!p.approved[msg.sender]) revert NotApproved(proposalId);
        if (p.executed) revert AlreadyExecuted(proposalId);

        p.approved[msg.sender] = false;
        p.approvalCount--;

        emit ApprovalRevoked(proposalId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Execute
    // -------------------------------------------------------------------------

    function executeAction(uint256 proposalId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        Proposal storage p = _proposals[proposalId];
        if (p.proposedAt == 0) revert ProposalNotFound(proposalId);
        if (p.executed || p.cancelled) revert AlreadyExecuted(proposalId);
        if (p.approvalCount < threshold)
            revert ThresholdNotMet(p.approvalCount, threshold);
        if (p.executeAfter != 0 && block.timestamp < p.executeAfter)
            revert TimelockActive(p.executeAfter, block.timestamp);

        p.executed = true;

        (bool success, bytes memory returnData) = p.target.call(p.callData);
        if (!success) revert ExecutionFailed(returnData);

        emit ActionExecuted(proposalId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    function getProposal(uint256 proposalId) external view returns (
        address target,
        string memory description,
        uint256 proposedAt,
        uint256 executeAfter,
        uint256 approvalCount,
        bool executed,
        bool cancelled
    ) {
        Proposal storage p = _proposals[proposalId];
        return (
            p.target,
            p.description,
            p.proposedAt,
            p.executeAfter,
            p.approvalCount,
            p.executed,
            p.cancelled
        );
    }

    function hasApproved(uint256 proposalId, address signer) external view returns (bool) {
        return _proposals[proposalId].approved[signer];
    }

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _isHighValueWithdrawal(bytes calldata callData) internal pure returns (bool) {
        // AgentVault.withdraw(address, uint256) selector = bytes4(keccak256("withdraw(address,uint256)"))
        if (callData.length < 68) return false;
        bytes4 selector = bytes4(callData[:4]);
        bytes4 withdrawSel = bytes4(keccak256("withdraw(address,uint256)"));
        if (selector != withdrawSel) return false;

        (, uint256 amount) = abi.decode(callData[4:], (address, uint256));
        return amount >= HIGH_VALUE_THRESHOLD;
    }
}
