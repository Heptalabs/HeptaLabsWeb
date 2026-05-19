#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Cyber/CyberGameplayTypes.h"
#include "CyberShopTerminal.generated.h"

class UBoxComponent;
class UStaticMeshComponent;
class UTextRenderComponent;
class ACyberAvatarCharacter;

UCLASS()
class TP_THIRDPERSON_API ACyberShopTerminal : public AActor
{
	GENERATED_BODY()

public:
	ACyberShopTerminal();

	FString GetInteractLabel() const;
	void Interact(ACyberAvatarCharacter* Character);
	void HandleOption(ACyberAvatarCharacter* Character, int32 OptionIndex);
	FString BuildMenuText() const;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<USceneComponent> Root;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UStaticMeshComponent> TerminalMesh;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UBoxComponent> InteractionBox;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UTextRenderComponent> LabelText;

	UPROPERTY(EditAnywhere, Category = "Shop")
	TArray<FCyberShopItem> ShopItems;
};
