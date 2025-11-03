// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProofPayEscrow
 * @notice Smart contract for managing escrow transactions on Base blockchain
 * @dev Handles USDC deposits, releases, disputes, and auto-release mechanism
 */
contract ProofPayEscrow is ReentrancyGuard, Ownable {
    
    IERC20 public immutable USDC;
    
    enum EscrowStatus { 
        CREATED,      // Escrow created, waiting for payment
        FUNDED,       // Payment received, waiting for delivery
        COMPLETED,    // Delivery confirmed, funds released
        DISPUTED,     // Dispute raised
        REFUNDED,     // Funds returned to buyer
        CANCELLED     // Escrow cancelled
    }
    
    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        uint256 createdAt;
        uint256 autoReleaseTime; // Timestamp for auto-release (7 days default)
        EscrowStatus status;
        bool disputeRaised;
        address disputeRaisedBy;
    }
    
    // Mapping of escrow ID to Escrow struct
    mapping(bytes32 => Escrow) public escrows;
    
    // Platform fee (0.5% = 50 basis points)
    uint256 public platformFeeBps = 50;
    address public feeCollector;
    
    // Auto-release time (7 days in seconds)
    uint256 public constant AUTO_RELEASE_PERIOD = 7 days;
    
    // Events
    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 autoReleaseTime
    );
    
    event EscrowFunded(bytes32 indexed escrowId, uint256 amount);
    event EscrowCompleted(bytes32 indexed escrowId, uint256 amountToSeller, uint256 platformFee);
    event EscrowRefunded(bytes32 indexed escrowId, uint256 amount);
    event DisputeRaised(bytes32 indexed escrowId, address raisedBy);
    event DisputeResolved(bytes32 indexed escrowId, uint256 buyerAmount, uint256 sellerAmount);
    event AutoReleaseExecuted(bytes32 indexed escrowId);
    
    constructor(address _usdcAddress, address _feeCollector) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_feeCollector != address(0), "Invalid fee collector");
        USDC = IERC20(_usdcAddress);
        feeCollector = _feeCollector;
    }
    
    /**
     * @notice Create a new escrow
     * @param buyer Address of the buyer
     * @param seller Address of the seller
     * @param amount Amount in USDC (with 6 decimals)
     * @return escrowId Unique identifier for the escrow
     */
    function createEscrow(
        address buyer,
        address seller,
        uint256 amount
    ) external returns (bytes32 escrowId) {
        require(buyer != address(0) && seller != address(0), "Invalid addresses");
        require(buyer != seller, "Buyer and seller cannot be the same");
        require(amount > 0, "Amount must be greater than 0");
        
        // Generate unique escrow ID
        escrowId = keccak256(
            abi.encodePacked(buyer, seller, amount, block.timestamp, block.number)
        );
        
        require(escrows[escrowId].buyer == address(0), "Escrow already exists");
        
        uint256 autoReleaseTime = block.timestamp + AUTO_RELEASE_PERIOD;
        
        escrows[escrowId] = Escrow({
            buyer: buyer,
            seller: seller,
            amount: amount,
            createdAt: block.timestamp,
            autoReleaseTime: autoReleaseTime,
            status: EscrowStatus.CREATED,
            disputeRaised: false,
            disputeRaisedBy: address(0)
        });
        
        emit EscrowCreated(escrowId, buyer, seller, amount, autoReleaseTime);
        
        return escrowId;
    }
    
    /**
     * @notice Fund an escrow with USDC
     * @param escrowId The escrow identifier
     */
    function fundEscrow(bytes32 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.CREATED, "Invalid escrow status");
        require(msg.sender == escrow.buyer, "Only buyer can fund");
        
        // Transfer USDC from buyer to contract
        require(
            USDC.transferFrom(msg.sender, address(this), escrow.amount),
            "USDC transfer failed"
        );
        
        escrow.status = EscrowStatus.FUNDED;
        
        emit EscrowFunded(escrowId, escrow.amount);
    }
    
    /**
     * @notice Release funds to seller (buyer confirms delivery)
     * @param escrowId The escrow identifier
     */
    function releaseFunds(bytes32 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not funded");
        require(msg.sender == escrow.buyer, "Only buyer can release");
        require(!escrow.disputeRaised, "Dispute is active");
        
        _completeEscrow(escrowId);
    }
    
    /**
     * @notice Auto-release funds after timeout period
     * @param escrowId The escrow identifier
     */
    function autoRelease(bytes32 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not funded");
        require(block.timestamp >= escrow.autoReleaseTime, "Auto-release time not reached");
        require(!escrow.disputeRaised, "Dispute is active");
        
        _completeEscrow(escrowId);
        emit AutoReleaseExecuted(escrowId);
    }
    
    /**
     * @notice Raise a dispute
     * @param escrowId The escrow identifier
     */
    function raiseDispute(bytes32 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not funded");
        require(
            msg.sender == escrow.buyer || msg.sender == escrow.seller,
            "Only buyer or seller can dispute"
        );
        require(!escrow.disputeRaised, "Dispute already raised");
        
        escrow.status = EscrowStatus.DISPUTED;
        escrow.disputeRaised = true;
        escrow.disputeRaisedBy = msg.sender;
        
        emit DisputeRaised(escrowId, msg.sender);
    }
    
    /**
     * @notice Resolve a dispute (owner/arbitrator only)
     * @param escrowId The escrow identifier
     * @param buyerPercentage Percentage to buyer (0-100)
     */
    function resolveDispute(
        bytes32 escrowId,
        uint256 buyerPercentage
    ) external onlyOwner nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.DISPUTED, "Not in dispute");
        require(buyerPercentage <= 100, "Invalid percentage");
        
        uint256 totalAmount = escrow.amount;
        uint256 buyerAmount = (totalAmount * buyerPercentage) / 100;
        uint256 sellerAmount = totalAmount - buyerAmount;
        
        if (buyerAmount > 0) {
            require(USDC.transfer(escrow.buyer, buyerAmount), "Buyer transfer failed");
        }
        
        if (sellerAmount > 0) {
            // Deduct platform fee from seller's portion
            uint256 platformFee = (sellerAmount * platformFeeBps) / 10000;
            uint256 sellerNet = sellerAmount - platformFee;
            
            require(USDC.transfer(escrow.seller, sellerNet), "Seller transfer failed");
            require(USDC.transfer(feeCollector, platformFee), "Fee transfer failed");
        }
        
        escrow.status = EscrowStatus.COMPLETED;
        
        emit DisputeResolved(escrowId, buyerAmount, sellerAmount);
    }
    
    /**
     * @notice Internal function to complete escrow and transfer funds
     */
    function _completeEscrow(bytes32 escrowId) internal {
        Escrow storage escrow = escrows[escrowId];
        
        uint256 platformFee = (escrow.amount * platformFeeBps) / 10000;
        uint256 sellerAmount = escrow.amount - platformFee;
        
        require(USDC.transfer(escrow.seller, sellerAmount), "Seller transfer failed");
        require(USDC.transfer(feeCollector, platformFee), "Fee transfer failed");
        
        escrow.status = EscrowStatus.COMPLETED;
        
        emit EscrowCompleted(escrowId, sellerAmount, platformFee);
    }
    
    /**
     * @notice Update platform fee (owner only)
     */
    function updatePlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        platformFeeBps = newFeeBps;
    }
    
    /**
     * @notice Update fee collector address (owner only)
     */
    function updateFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid address");
        feeCollector = newCollector;
    }
    
    /**
     * @notice Get escrow details
     */
    function getEscrow(bytes32 escrowId) external view returns (
        address buyer,
        address seller,
        uint256 amount,
        uint256 createdAt,
        uint256 autoReleaseTime,
        EscrowStatus status,
        bool disputeRaised
    ) {
        Escrow memory escrow = escrows[escrowId];
        return (
            escrow.buyer,
            escrow.seller,
            escrow.amount,
            escrow.createdAt,
            escrow.autoReleaseTime,
            escrow.status,
            escrow.disputeRaised
        );
    }
}

