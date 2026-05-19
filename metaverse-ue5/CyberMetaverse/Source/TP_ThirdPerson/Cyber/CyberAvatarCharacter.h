#pragma once

#include "CoreMinimal.h"
#include "TP_ThirdPersonCharacter.h"
#include "CyberAvatarCharacter.generated.h"

class ACyberShopTerminal;
class ACyberCasinoTable;
class ACyberSpeechPodium;
class ACyberPortalActor;
class UStaticMeshComponent;

UENUM()
enum class ECyberInteractionMode : uint8
{
	None,
	Shop,
	Casino,
	Speech
};

UCLASS()
class TP_THIRDPERSON_API ACyberAvatarCharacter : public ATP_ThirdPersonCharacter
{
	GENERATED_BODY()

public:
	ACyberAvatarCharacter();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	bool SpendCoins(int32 Amount);
	void AddCoins(int32 Amount);
	void AddInventoryItem(const FName ItemId, int32 Amount);

	void PushStatusMessage(const FString& Message);

	void OpenShop(ACyberShopTerminal* Terminal);
	void OpenCasino(ACyberCasinoTable* Table);
	void OpenSpeech(ACyberSpeechPodium* Podium);
	void CloseInteractionMode();

protected:
	void MoveForwardLegacy(float Value);
	void MoveRightLegacy(float Value);
	void TurnLegacy(float Value);
	void LookUpLegacy(float Value);

	void OnInteractPressed();
	void OnOption1Pressed();
	void OnOption2Pressed();
	void OnOption3Pressed();

	void HandleOption(int32 OptionIndex);
	AActor* TraceInteractable() const;
	FString BuildPromptText() const;
	FString BuildInventorySummary() const;
	void RefreshHud();
	void InitializeCyberpunkSuit();

	UPROPERTY(EditAnywhere, Category = "Player")
	int32 Coins = 1000;

	UPROPERTY(EditAnywhere, Category = "Player")
	float InteractionDistance = 420.0f;

	UPROPERTY(EditAnywhere, Category = "Player")
	float TurnSensitivity = 1.0f;

	UPROPERTY(EditAnywhere, Category = "Player")
	float LookSensitivity = 1.0f;

	UPROPERTY(VisibleAnywhere, Category = "Player")
	TMap<FName, int32> Inventory;

	TWeakObjectPtr<AActor> FocusedActor;
	ECyberInteractionMode InteractionMode = ECyberInteractionMode::None;

	TWeakObjectPtr<ACyberShopTerminal> ActiveShop;
	TWeakObjectPtr<ACyberCasinoTable> ActiveCasino;
	TWeakObjectPtr<ACyberSpeechPodium> ActivePodium;

	FString StatusMessage;
	float StatusMessageRemaining = 0.0f;

	UPROPERTY(VisibleAnywhere, Category = "Visual")
	TObjectPtr<UStaticMeshComponent> ChestCoreMesh;

	UPROPERTY(VisibleAnywhere, Category = "Visual")
	TObjectPtr<UStaticMeshComponent> BackCoreMesh;

	UPROPERTY(VisibleAnywhere, Category = "Visual")
	TObjectPtr<UStaticMeshComponent> VisorMesh;
};
