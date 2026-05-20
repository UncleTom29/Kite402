// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SpendPolicyLib} from "./SpendPolicyLib.sol";

contract AgentVault is UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SpendPolicyLib for SpendPolicyLib.SpendPolicy;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    bytes32 public agentId;
    IERC20 public settlementToken;
    SpendPolicyLib.SpendPolicy public spendPolicy;

    // approved operators in addition to owner (e.g. multisig)
    mapping(address => bool) public approvedOperators;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Deposited(bytes32 indexed agentId, uint256 amount);
    event Withdrawn(bytes32 indexed agentId, address indexed to, uint256 amount);
    event PolicyUpdated(bytes32 indexed agentId);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event Suspended(bytes32 indexed agentId);
    event Resumed(bytes32 indexed agentId);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error Unauthorized();
    error InsufficientBalance(uint256 available, uint256 requested);
    error InvalidPolicy();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyAuthorized() {
        if (msg.sender != owner() && !approvedOperators[msg.sender]) revert Unauthorized();
        _;
    }

    // -------------------------------------------------------------------------
    // Initializer (replaces constructor for UUPS)
    // -------------------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        bytes32 _agentId,
        address _settlementToken,
        SpendPolicyLib.SpendPolicy calldata _policy
    ) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        agentId = _agentId;
        settlementToken = IERC20(_settlementToken);
        _validateAndSetPolicy(_policy);
    }

    // -------------------------------------------------------------------------
    // Deposit
    // -------------------------------------------------------------------------

    function deposit(uint256 amount) external nonReentrant {
        settlementToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(agentId, amount);
    }

    // -------------------------------------------------------------------------
    // Withdraw (spend enforcement)
    // -------------------------------------------------------------------------

    function withdraw(address to, uint256 amount) external onlyAuthorized nonReentrant {
        spendPolicy.enforce(amount);

        uint256 balance = settlementToken.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(balance, amount);

        spendPolicy.record(amount);
        settlementToken.safeTransfer(to, amount);
        emit Withdrawn(agentId, to, amount);
    }

    // -------------------------------------------------------------------------
    // Policy management
    // -------------------------------------------------------------------------

    function configurePolicy(SpendPolicyLib.SpendPolicy calldata _policy)
        external
        onlyAuthorized
    {
        _validateAndSetPolicy(_policy);
        emit PolicyUpdated(agentId);
    }

    function suspend() external onlyAuthorized {
        spendPolicy.suspended = true;
        emit Suspended(agentId);
    }

    function resume() external onlyAuthorized {
        spendPolicy.suspended = false;
        emit Resumed(agentId);
    }

    // -------------------------------------------------------------------------
    // Operator management
    // -------------------------------------------------------------------------

    function addOperator(address operator) external onlyOwner {
        approvedOperators[operator] = true;
        emit OperatorAdded(operator);
    }

    function removeOperator(address operator) external onlyOwner {
        approvedOperators[operator] = false;
        emit OperatorRemoved(operator);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function balance() external view returns (uint256) {
        return settlementToken.balanceOf(address(this));
    }

    function getPolicy() external view returns (SpendPolicyLib.SpendPolicy memory) {
        return spendPolicy;
    }

    // -------------------------------------------------------------------------
    // UUPS authorisation
    // -------------------------------------------------------------------------

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _validateAndSetPolicy(SpendPolicyLib.SpendPolicy calldata _policy) internal {
        if (
            _policy.perOrderLimit == 0 ||
            _policy.dailyLimit == 0 ||
            _policy.lifetimeLimit == 0 ||
            _policy.perOrderLimit > _policy.dailyLimit ||
            _policy.dailyLimit > _policy.lifetimeLimit
        ) revert InvalidPolicy();

        spendPolicy.perOrderLimit = _policy.perOrderLimit;
        spendPolicy.dailyLimit = _policy.dailyLimit;
        spendPolicy.lifetimeLimit = _policy.lifetimeLimit;
        // retain runtime counters — do not reset spent amounts on policy update
        if (spendPolicy.dayStart == 0) {
            spendPolicy.dayStart = block.timestamp - (block.timestamp % 1 days);
        }
    }
}
