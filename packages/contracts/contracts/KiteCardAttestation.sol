// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title KiteCardAttestation
 * @notice Stores immutable on-chain attestations for every virtual card issuance.
 *         Raw card data (PAN, CVV) is NEVER stored — only keccak256(pan+expiry) hashes.
 */
contract KiteCardAttestation is Ownable {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Attestation {
        bytes32 agentId;
        uint256 usdcAmount;
        bytes32 cardHash;    // keccak256(pan ++ expiry) — never stores raw card data
        uint256 timestamp;
        bool revoked;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    mapping(bytes32 => Attestation) public attestations;

    // approved attestors (the Kite402 API signing wallet)
    mapping(address => bool) public attestors;

    uint256 private _attestationNonce;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event CardAttested(bytes32 indexed attestationId, bytes32 indexed agentId, uint256 timestamp);
    event CardRevoked(bytes32 indexed attestationId);
    event AttestorAdded(address indexed attestor);
    event AttestorRemoved(address indexed attestor);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error Unauthorized();
    error AlreadyRevoked(bytes32 attestationId);
    error AttestationNotFound(bytes32 attestationId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _owner) Ownable(_owner) {}

    // -------------------------------------------------------------------------
    // Attestor management
    // -------------------------------------------------------------------------

    function addAttestor(address attestor) external onlyOwner {
        attestors[attestor] = true;
        emit AttestorAdded(attestor);
    }

    function removeAttestor(address attestor) external onlyOwner {
        attestors[attestor] = false;
        emit AttestorRemoved(attestor);
    }

    // -------------------------------------------------------------------------
    // Attest
    // -------------------------------------------------------------------------

    function attest(
        bytes32 agentId,
        uint256 usdcAmount,
        bytes32 cardHash
    ) external returns (bytes32 attestationId) {
        if (!attestors[msg.sender] && msg.sender != owner())
            revert Unauthorized();

        attestationId = keccak256(
            abi.encodePacked(agentId, usdcAmount, cardHash, block.timestamp, ++_attestationNonce)
        );

        attestations[attestationId] = Attestation({
            agentId: agentId,
            usdcAmount: usdcAmount,
            cardHash: cardHash,
            timestamp: block.timestamp,
            revoked: false
        });

        emit CardAttested(attestationId, agentId, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Revoke
    // -------------------------------------------------------------------------

    function revoke(bytes32 attestationId) external {
        if (!attestors[msg.sender] && msg.sender != owner())
            revert Unauthorized();

        Attestation storage att = attestations[attestationId];
        if (att.timestamp == 0) revert AttestationNotFound(attestationId);
        if (att.revoked) revert AlreadyRevoked(attestationId);

        att.revoked = true;
        emit CardRevoked(attestationId);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    function getAttestation(bytes32 attestationId) external view returns (Attestation memory) {
        return attestations[attestationId];
    }

    function hashCard(string calldata pan, string calldata expiry) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(pan, expiry));
    }
}
