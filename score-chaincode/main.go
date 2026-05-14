package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"score-chaincode/chaincode"
)

func main() {
	cc, err := contractapi.NewChaincode(&chaincode.SmartContract{})
	if err != nil {
		log.Panicf("chaincode factory: %v", err)
	}
	if err := cc.Start(); err != nil {
		log.Panicf("chaincode start: %v", err)
	}
}
