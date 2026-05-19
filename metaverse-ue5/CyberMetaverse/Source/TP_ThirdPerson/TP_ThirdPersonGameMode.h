// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "TP_ThirdPersonGameMode.generated.h"

enum class ECyberDistrict : uint8;
class ACyberDistrictBuilder;

/**
 *  Simple GameMode for a third person game
 */
UCLASS(abstract)
class ATP_ThirdPersonGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	
	/** Constructor */
	ATP_ThirdPersonGameMode();

	virtual void BeginPlay() override;

protected:
	ECyberDistrict ResolveDistrictFromMapName() const;

	UPROPERTY(EditAnywhere, Category = "Cyber")
	TSubclassOf<ACyberDistrictBuilder> DistrictBuilderClass;
};


