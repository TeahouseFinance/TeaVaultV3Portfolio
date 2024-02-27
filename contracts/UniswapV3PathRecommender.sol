// SPDX-License-Identifier: BUSL-1.1
// Teahouse Finance

pragma solidity =0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";

contract UniswapV3PathRecommender is Ownable {

    error TokensFeesLengthMismatch();
    // AUDIT: UVP-03C
    event SwapPathSet(address indexed srcToken, address indexed dstToken, bytes pathExactInput, bytes pathExactOutput);
    event SwapPathDeleted(address indexed srcToken, address indexed dstToken);
    // AUDIT: UVP-01C, UVP-05C
    mapping(address => mapping(address => mapping(bool => bytes))) private _swapPath;

    function setRecommendedPath(
        address[] calldata _tokens,
        uint24[] calldata _fees
    ) external onlyOwner returns (
        bytes memory pathExactInput,
        bytes memory pathExactOutput
    ) {
        uint256 feesLength = _fees.length;
        uint256 tokensLength = _tokens.length;
        if (tokensLength != feesLength + 1) revert TokensFeesLengthMismatch();

        address srcToken = _tokens[0];
        address dstToken = _tokens[tokensLength - 1];
        // swap router path:
        //    exact input: abi.encodePacked(srcToken, fee, intermediaryToken, ..., fee, dstToken)
        //    exact output: abi.encodePacked(dstToken, fee, intermediaryToken, ..., fee, srcToken)
        // sample of DAI => WETH9: DAI to USDC and then USDC to WETH9
        //    exact input: the path encoding is (DAI, 0.3%, USDC, 0.3%, WETH9)
        //    exact output: the path encoding is (WETH9, 0.3%, USDC, 0.3%, DAI)
        pathExactInput = abi.encodePacked(srcToken);
        pathExactOutput = abi.encodePacked(dstToken);
        // AUDIT: UVP-02C
        unchecked {
            // AUDIT: UVP-06C
            uint256 feesLengthMinus1 = feesLength - 1;
            // AUDIT: UVP-04C
            for (uint256 i; i < feesLength; i = i + 1) {
                pathExactInput = bytes.concat(
                    pathExactInput,
                    abi.encodePacked(_fees[i], _tokens[i + 1])
                );
                pathExactOutput = bytes.concat(
                    pathExactOutput,
                    abi.encodePacked(_fees[feesLengthMinus1 - i], _tokens[feesLengthMinus1 - i])
                );
            }
        }

        _swapPath[srcToken][dstToken][true] = pathExactInput;
        _swapPath[srcToken][dstToken][false] = pathExactOutput;
        emit SwapPathSet(srcToken, dstToken, pathExactInput, pathExactOutput);
    }

    function getRecommendedPath(bool _isExactInput, address _srcToken, address _dstToken) external view returns (bytes memory path) {
        return _swapPath[_srcToken][_dstToken][_isExactInput];
    }

    function deleteRecommendedPath(address _srcToken, address _dstToken) external onlyOwner {
        delete _swapPath[_srcToken][_dstToken][true];
        delete _swapPath[_srcToken][_dstToken][false];
        emit SwapPathDeleted(_srcToken, _dstToken);
    }
}