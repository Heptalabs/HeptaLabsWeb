#pragma once

#include "CoreMinimal.h"
#include "CyberGameplayTypes.generated.h"

UENUM(BlueprintType)
enum class ECyberDistrict : uint8
{
	Plaza UMETA(DisplayName = "Plaza"),
	Shop UMETA(DisplayName = "Shop"),
	Casino UMETA(DisplayName = "Casino")
};

UENUM(BlueprintType)
enum class ECyberBetChoice : uint8
{
	Player UMETA(DisplayName = "Player"),
	Banker UMETA(DisplayName = "Banker"),
	Tie UMETA(DisplayName = "Tie")
};

USTRUCT(BlueprintType)
struct FCyberShopItem
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shop")
	FName ItemId = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shop")
	FString DisplayName = TEXT("Item");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shop")
	int32 Price = 100;
};
