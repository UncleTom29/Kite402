// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library SpendPolicyLib {
    error PolicyViolation(string reason);

    struct SpendPolicy {
        uint256 perOrderLimit;   // max USDC per single transaction (6 decimals)
        uint256 dailyLimit;      // max USDC per rolling 24h window
        uint256 lifetimeLimit;   // max USDC total ever
        uint256 dailySpent;      // USDC spent since dayStart
        uint256 lifetimeSpent;   // USDC spent all time
        uint256 dayStart;        // unix timestamp of the current day window start
        bool suspended;          // hard suspension flag
    }

    function enforce(SpendPolicy storage policy, uint256 amount) internal view {
        if (policy.suspended) revert PolicyViolation("agent suspended");
        if (amount == 0) revert PolicyViolation("zero amount");
        if (amount > policy.perOrderLimit) revert PolicyViolation("per-order limit exceeded");

        uint256 effectiveDailySpent = _effectiveDailySpent(policy);
        if (effectiveDailySpent + amount > policy.dailyLimit)
            revert PolicyViolation("daily limit exceeded");

        if (policy.lifetimeSpent + amount > policy.lifetimeLimit)
            revert PolicyViolation("lifetime limit exceeded");
    }

    function record(SpendPolicy storage policy, uint256 amount) internal {
        _maybeResetDaily(policy);
        policy.dailySpent += amount;
        policy.lifetimeSpent += amount;
    }

    function resetDaily(SpendPolicy storage policy) internal {
        policy.dayStart = _startOfDay(block.timestamp);
        policy.dailySpent = 0;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _effectiveDailySpent(SpendPolicy storage policy) private view returns (uint256) {
        if (block.timestamp >= policy.dayStart + 1 days) return 0;
        return policy.dailySpent;
    }

    function _maybeResetDaily(SpendPolicy storage policy) private {
        if (block.timestamp >= policy.dayStart + 1 days) {
            policy.dayStart = _startOfDay(block.timestamp);
            policy.dailySpent = 0;
        }
    }

    function _startOfDay(uint256 ts) private pure returns (uint256) {
        return ts - (ts % 1 days);
    }
}
