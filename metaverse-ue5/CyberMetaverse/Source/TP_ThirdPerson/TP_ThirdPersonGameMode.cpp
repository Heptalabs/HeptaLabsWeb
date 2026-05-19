// Copyright Epic Games, Inc. All Rights Reserved.

#include "TP_ThirdPersonGameMode.h"
#include "Cyber/CyberAvatarCharacter.h"
#include "Cyber/CyberDistrictBuilder.h"
#include "Cyber/CyberGameplayTypes.h"
#include "Cyber/CyberPlayerController.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerStart.h"

ATP_ThirdPersonGameMode::ATP_ThirdPersonGameMode()
{
	DefaultPawnClass = ACyberAvatarCharacter::StaticClass();
	PlayerControllerClass = ACyberPlayerController::StaticClass();
	DistrictBuilderClass = ACyberDistrictBuilder::StaticClass();
}

void ATP_ThirdPersonGameMode::BeginPlay()
{
	Super::BeginPlay();

	bool bHasPlayerStart = false;
	for (TActorIterator<APlayerStart> It(GetWorld()); It; ++It)
	{
		bHasPlayerStart = true;
		break;
	}

	if (!bHasPlayerStart)
	{
		GetWorld()->SpawnActor<APlayerStart>(FVector(0.0f, 0.0f, 200.0f), FRotator::ZeroRotator);
	}

	if (DistrictBuilderClass)
	{
		ACyberDistrictBuilder* Builder = GetWorld()->SpawnActor<ACyberDistrictBuilder>(DistrictBuilderClass, FVector::ZeroVector, FRotator::ZeroRotator);
		if (Builder)
		{
			Builder->BuildDistrict(ResolveDistrictFromMapName());
		}
	}
}

ECyberDistrict ATP_ThirdPersonGameMode::ResolveDistrictFromMapName() const
{
	const FString MapName = GetWorld()->GetMapName();
	if (MapName.Contains(TEXT("CyberShop"), ESearchCase::IgnoreCase))
	{
		return ECyberDistrict::Shop;
	}
	if (MapName.Contains(TEXT("CyberCasino"), ESearchCase::IgnoreCase))
	{
		return ECyberDistrict::Casino;
	}
	return ECyberDistrict::Plaza;
}
