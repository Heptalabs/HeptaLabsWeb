#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CyberSpeechPodium.generated.h"

class UBoxComponent;
class UStaticMeshComponent;
class UTextRenderComponent;
class ACyberAvatarCharacter;

UCLASS()
class TP_THIRDPERSON_API ACyberSpeechPodium : public AActor
{
	GENERATED_BODY()

public:
	ACyberSpeechPodium();

	FString GetInteractLabel(const ACyberAvatarCharacter* Requester) const;
	void Interact(ACyberAvatarCharacter* Character);
	void HandleOption(ACyberAvatarCharacter* Character, int32 OptionIndex);
	bool IsCurrentSpeaker(const ACyberAvatarCharacter* Character) const;
	FString BuildMenuText() const;

protected:
	void SetBanner(const FString& Text);

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<USceneComponent> Root;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UStaticMeshComponent> PodiumMesh;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UBoxComponent> InteractionBox;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UTextRenderComponent> BannerText;

	UPROPERTY(EditAnywhere, Category = "Speech")
	TArray<FString> SpeechLines;

	int32 SpeechCursor = 0;

	TWeakObjectPtr<ACyberAvatarCharacter> CurrentSpeaker;
};
