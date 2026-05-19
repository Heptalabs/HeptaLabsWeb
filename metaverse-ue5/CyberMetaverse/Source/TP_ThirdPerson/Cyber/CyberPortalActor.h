#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CyberPortalActor.generated.h"

class UBoxComponent;
class UStaticMeshComponent;
class UTextRenderComponent;
class ACyberAvatarCharacter;

UCLASS()
class TP_THIRDPERSON_API ACyberPortalActor : public AActor
{
	GENERATED_BODY()

public:
	ACyberPortalActor();

	FString GetInteractLabel() const;
	void Interact(ACyberAvatarCharacter* Character);
	void ConfigurePortal(const FName InTargetLevel, const FString& InPortalName);

protected:
	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<USceneComponent> Root;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UStaticMeshComponent> FrameMesh;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UBoxComponent> InteractionBox;

	UPROPERTY(VisibleAnywhere, Category = "Components")
	TObjectPtr<UTextRenderComponent> LabelText;

	UPROPERTY(EditAnywhere, Category = "Portal")
	FName TargetLevel;

	UPROPERTY(EditAnywhere, Category = "Portal")
	FString PortalName;
};
