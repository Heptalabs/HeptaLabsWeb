#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Cyber/CyberGameplayTypes.h"
#include "CyberCasinoTable.generated.h"

class UBoxComponent;
class UStaticMeshComponent;
class UTextRenderComponent;
class ACyberAvatarCharacter;

UCLASS()
class TP_THIRDPERSON_API ACyberCasinoTable : public AActor
{
	GENERATED_BODY()

public:
	ACyberCasinoTable();

	FString GetInteractLabel() const;
	void Interact(ACyberAvatarCharacter* Character);
	void HandleOption(ACyberAvatarCharacter* Character, int32 OptionIndex);
	FString BuildMenuText() const;

protected:
	int32 DrawCard() const;
	int32 ScoreHand(int32 A, int32 B) const;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<USceneComponent> Root;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UStaticMeshComponent> TableMesh;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UBoxComponent> InteractionBox;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UTextRenderComponent> LabelText;

	UPROPERTY(EditAnywhere, Category = "Casino")
	int32 BaseBet = 100;
};
